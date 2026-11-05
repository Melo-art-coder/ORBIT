
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const chatMessages = $("#chatMessages");
  const messageInput = $("#messageInput");
  const sendButton = $("#sendMessageButton");
  const clearButton = $("#clearChatButton");

  const suggestions = document.querySelectorAll("[data-prompt]");

  // --------------------------------
  // BASIC HELPERS
  // --------------------------------

  function showMessage(message, type = "info") {
    let notice = $("#studyNotice");

    if (!notice) {
      notice = document.createElement("div");
      notice.id = "studyNotice";
      notice.className = "study-notice";

      const intro = document.querySelector(".study-intro");

      if (intro) {
        intro.insertAdjacentElement("afterend", notice);
      } else {
        document.body.prepend(notice);
      }
    }

    notice.textContent = message;
    notice.dataset.type = type;
  }

  function setText(selector, value, fallback = "") {
    const element = $(selector);

    if (element) {
      element.textContent = value || fallback;
    }
  }

  function getInitials(name = "") {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function formatGreeting(name) {
    const hour = new Date().getHours();

    let greeting = "Hello";

    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    return `${greeting}, ${name || "student"}.`;
  }

  // --------------------------------
  // CHAT COMING SOON STATE
  // --------------------------------

  function setComingSoonState() {
    if (messageInput) {
      messageInput.disabled = true;
      messageInput.placeholder =
        "The ORBIT Study Companion is coming soon...";
    }

    if (sendButton) {
      sendButton.disabled = true;
      sendButton.textContent = "Coming soon";
      sendButton.setAttribute("aria-label", "AI Study Companion coming soon");
    }

    suggestions.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });

    if (chatMessages) {
      const welcome = document.createElement("div");
      welcome.className = "coming-soon-card";

      const icon = document.createElement("div");
      icon.className = "coming-soon-icon";
      icon.textContent = "✳";

      const heading = document.createElement("h3");
      heading.textContent = "Something brilliant is brewing.";

      const description = document.createElement("p");
      description.textContent =
        "Your personal AI study companion is on its way. Soon, you'll be able to explore difficult topics, understand your course materials, create study plans and practise what you've learned.";

      const label = document.createElement("span");
      label.className = "coming-soon-label";
      label.textContent = "ORBIT AI · COMING SOON";

      welcome.append(icon, heading, description, label);

      chatMessages.appendChild(welcome);
    }

    showMessage(
      "The Study Companion is being prepared. Other ORBIT features remain available.",
      "info"
    );
  }

  // --------------------------------
  // AUTHENTICATION
  // --------------------------------

  async function checkAuthentication() {
    if (!window.orbitAuth || !window.orbitSupabase) {
      showMessage(
        "ORBIT could not load its authentication service. Please refresh the page.",
        "error"
      );

      return null;
    }

    try {
      const session = await window.orbitAuth.getSession();

      if (!session) {
        window.location.href = "login.html";
        return null;
      }

      return session;
    } catch (error) {
      console.error("ORBIT authentication error:", error);

      showMessage(
        "We couldn't verify your account. Please refresh and try again.",
        "error"
      );

      return null;
    }
  }

  // --------------------------------
  // STUDENT INFORMATION
  // --------------------------------

  async function loadStudent(session) {
    const client = window.orbitSupabase;
    const user = session.user;

    try {
      const { data: profile, error } = await client
        .from("student_profiles")
        .select(
          "display_name, full_name, university, faculty, department, programme, study_level, academic_session, semester, setup_completed"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!profile || !profile.setup_completed) {
        window.location.href = "setup.html";
        return null;
      }

      const { data: courses, error: courseError } = await client
        .from("student_courses")
        .select("code, title, units")
        .eq("user_id", user.id)
        .order("code");

      if (courseError) throw courseError;

      const student = {
        ...profile,
        courses: courses || []
      };

      displayStudent(student);

      return student;
    } catch (error) {
      console.error("ORBIT student information error:", error);

      showMessage(
        "We couldn't load your academic profile. Please try again.",
        "error"
      );

      return null;
    }
  }

  function displayStudent(student) {
    const name =
      student.display_name ||
      student.full_name ||
      "Student";

    setText("#studentName", name, "Student");
    setText("#studyGreeting", formatGreeting(name));

    setText(
      "#studentInstitution",
      student.university,
      "Your institution"
    );

    setText(
      "#studentProgramme",
      student.programme,
      "Your programme"
    );

    setText(
      "#studentLevel",
      student.study_level,
      "Your level"
    );

    setText(
      "#studentCourseCount",
      student.courses.length,
      "0"
    );

    const avatar = $("#studentAvatar");

    if (avatar) {
      avatar.textContent = getInitials(name);
    }
  }

  // --------------------------------
  // CLEAR CHAT
  // --------------------------------

  function clearChat() {
    if (!chatMessages) return;

    chatMessages.replaceChildren();

    setComingSoonState();
  }

  if (clearButton) {
    clearButton.addEventListener("click", clearChat);
  }

  // --------------------------------
  // INITIALISE PAGE
  // --------------------------------

  setComingSoonState();

  const session = await checkAuthentication();

  if (!session) return;

  await loadStudent(session);
});
