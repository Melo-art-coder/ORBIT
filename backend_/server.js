
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const requiredVariables = [
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  OPENAI_API_KEY
];

if (requiredVariables.some(value => !value)) {
  console.error("ORBIT: Missing required environment variables.");
  process.exit(1);
}

// ==========================================
// SECURITY AND MIDDLEWARE
// ==========================================

app.disable("x-powered-by");

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Origin not allowed."));
      }
    : true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({
  limit: "20kb"
}));

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait a moment and try again."
  }
});

// ==========================================
// SUPABASE CLIENT
// ==========================================

function getStudentSupabase(token) {
  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );
}

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

async function authenticateStudent(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Please sign in to use ORBIT AI."
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        error: "Your login session is invalid."
      });
    }

    const supabase = getStudentSupabase(token);

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Your session has expired. Please sign in again."
      });
    }

    req.student = user;
    req.supabase = supabase;

    next();

  } catch (error) {
    console.error("ORBIT authentication error:", error);

    return res.status(500).json({
      error: "We couldn't verify your account."
    });
  }
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.json({
    service: "ORBIT AI",
    status: "online",
    message: "Your learning companion is ready."
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ORBIT AI backend"
  });
});

// ==========================================
// STUDENT ACADEMIC CONTEXT
// ==========================================

async function getAcademicContext(supabase, userId) {
  const { data: profile, error: profileError } =
    await supabase
      .from("student_profiles")
      .select(
        "display_name, full_name, university, faculty, department, programme, study_level, academic_session, semester, setup_completed"
      )
      .eq("user_id", userId)
      .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || !profile.setup_completed) {
    throw new Error("Please complete your ORBIT student setup first.");
  }

  const { data: courses, error: coursesError } =
    await supabase
      .from("student_courses")
      .select("code, title, units")
      .eq("user_id", userId)
      .order("code");

  if (coursesError) {
    throw coursesError;
  }

  return {
    name: profile.display_name || profile.full_name || "Student",
    institution: profile.university || "Not provided",
    faculty: profile.faculty || "Not provided",
    department: profile.department || "Not provided",
    programme: profile.programme || "Not provided",
    level: profile.study_level || "Not provided",
    session: profile.academic_session || "Not provided",
    semester: profile.semester || "Not provided",
    courses: (courses || []).map(course => ({
      code: course.code,
      title: course.title,
      units: course.units
    }))
  };
}

// ==========================================
// VALIDATE CONVERSATION HISTORY
// ==========================================

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-12)
    .filter(item =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string" &&
      item.content.trim().length > 0 &&
      item.content.length <= 5000
    )
    .map(item => ({
      role: item.role,
      content: item.content.trim()
    }));
}

// ==========================================
// ORBIT AI CHAT ENDPOINT
// ==========================================

app.post(
  "/api/ai/chat",
  aiLimiter,
  authenticateStudent,
  async (req, res) => {
    try {
      const { message, history } = req.body || {};

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return res.status(400).json({
          error: "Please enter a question."
        });
      }

      const cleanMessage = message.trim();

      if (cleanMessage.length > 5000) {
        return res.status(400).json({
          error: "Your question is too long. Please shorten it."
        });
      }

      // Retrieve verified academic information.
      // Never trust academic details supplied by the browser.
      const academic = await getAcademicContext(
        req.supabase,
        req.student.id
      );

      const systemPrompt = `
You are ORBIT AI, a helpful academic study companion.

YOUR PURPOSE:
Help students understand their academic work, learn concepts,
solve appropriate exercises, prepare for lectures and develop
strong study habits.

STUDENT CONTEXT:
Name: ${academic.name}
Institution: ${academic.institution}
Faculty: ${academic.faculty}
Department: ${academic.department}
Programme: ${academic.programme}
Level: ${academic.level}
Academic session: ${academic.session}
Semester: ${academic.semester}

REGISTERED COURSES:
${academic.courses.length
  ? academic.courses.map(course =>
      `${course.code}: ${course.title} (${course.units} units)`
    ).join("\n")
  : "No courses registered yet."}

HOW TO RESPOND:
1. Explain difficult ideas in clear, student-friendly language.
2. Adapt explanations to the student's academic level.
3. Use examples, comparisons and step-by-step reasoning when useful.
4. When relevant, connect explanations to the student's courses.
5. Support different institutions and academic programmes.
6. Do not assume the student attends any particular institution.
7. If information is uncertain, say so instead of inventing facts.
8. For calculations, show the important working steps.
9. Use headings and lists when they improve readability.
10. Be encouraging, respectful and concise without sacrificing clarity.
11. Never claim to have accessed lecture materials that the student
    has not supplied.
12. If asked about something outside academics, respond naturally
    while keeping the conversation appropriate for a student.

You are an educational assistant, not a replacement for lecturers,
official academic materials or institutional guidance.
`;

      const messages = [
        {
          role: "system",
          content: systemPrompt
        },
        ...cleanHistory(history),
        {
          role: "user",
          content: cleanMessage
        }
      ];

      // Call the AI provider securely from the backend.
      const aiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },

          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages,
            temperature: 0.6,
            max_tokens: 1200
          }),

          signal: AbortSignal.timeout(45000)
        }
      );

      const aiData = await aiResponse.json();

      if (!aiResponse.ok) {
        console.error(
          "ORBIT AI provider error:",
          aiData.error?.message || aiResponse.status
        );

        return res.status(502).json({
          error: "ORBIT AI couldn't generate an answer right now. Please try again."
        });
      }

      const reply =
        aiData.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        return res.status(502).json({
          error: "ORBIT AI returned an empty answer."
        });
      }

      return res.json({
        reply,
        usage: aiData.usage || null
      });

    } catch (error) {
      console.error("ORBIT AI request error:", error);

      const message = error.name === "TimeoutError"
        ? "The AI took too long to respond. Please try again."
        : error.message === "Please complete your ORBIT student setup first."
          ? error.message
          : "Something went wrong. Please try again.";

      return res.status(
        error.message === "Please complete your ORBIT student setup first."
          ? 403
          : 500
      ).json({
        error: message
      });
    }
  }
);

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
  console.error("ORBIT server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`ORBIT backend running on port ${PORT}`);
});
