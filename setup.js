/* =========================================
   ORBIT — STUDENT ONBOARDING ENGINE
   Supabase + Profile + Courses + Themes
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // =====================================
  // 1. ELEMENTS
  // =====================================

  const $ = selector => document.querySelector(selector);

  const form = $("#setupForm");
  const message = $("#setupMessage");
  const finishButton = $("#finishSetupButton");
  const courseList = $("#courseList");
  const courseEmpty = $("#courseEmpty");

  const displayNameInput = $("#displayName");
  const fullNameInput = $("#fullName");
  const institutionInput = $("#institution");
  const facultyInput = $("#faculty");
  const departmentInput = $("#department");
  const programmeInput = $("#programme");
  const studyLevelInput = $("#studyLevel");
  const sessionInput = $("#academicSession");
  const semesterInput = $("#semester");

  const courseCodeInput = $("#courseCode");
  const courseTitleInput = $("#courseTitle");
  const courseUnitsInput = $("#courseUnits");
  const addCourseButton = $("#addCourseButton");

  const yearElement = $("#currentYear");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // =====================================
  // 2. APPLICATION STATE
  // =====================================

  let courses = [];
  let currentUser = null;

  const supabase = window.orbitSupabase;

  if (!window.orbitAuth || !supabase) {
    showMessage("ORBIT could not connect. Please refresh the page.");
    return;
  }

  // =====================================
  // 3. GENERAL HELPERS
  // =====================================

  function clean(value) {
    return String(value || "").trim();
  }

  function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `setup-message show ${type}`;

    message.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function hideMessage() {
    if (!message) return;

    message.textContent = "";
    message.className = "setup-message";
  }

  function setLoading(loading) {
    if (!finishButton) return;

    finishButton.disabled = loading;

    finishButton.textContent = loading
      ? "Saving your ORBIT..."
      : "Finish setup";
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  // =====================================
  // 4. THEME ENGINE
  // =====================================

  function getSelectedTheme() {
    return $(
      'input[name="theme"]:checked'
    )?.value || "light";
  }

  function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = selectedTheme;

    localStorage.setItem("orbitTheme", selectedTheme);

    const themeColor = document.querySelector(
      'meta[name="theme-color"]'
    );

    if (themeColor) {
      themeColor.content =
        selectedTheme === "dark" ? "#19171d" : "#f8f6f1";
    }

    document.querySelectorAll("[data-theme-option]").forEach(option => {
      const input = option.querySelector('input[name="theme"]');

      option.classList.toggle(
        "selected",
        Boolean(input && input.checked)
      );
    });
  }

  function updateThemeSelection() {
    applyTheme(getSelectedTheme());
  }

  // Apply saved theme immediately.
  const savedLocalTheme = localStorage.getItem("orbitTheme");

  if (savedLocalTheme) {
    const savedInput = $(
      `input[name="theme"][value="${savedLocalTheme}"]`
    );

    if (savedInput) {
      savedInput.checked = true;
    }

    applyTheme(savedLocalTheme);
  }

  document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener("change", updateThemeSelection);
  });

  // =====================================
  // 5. COURSE ENGINE
  // =====================================

  function renderCourses() {
    if (!courseList || !courseEmpty) return;

    courseList.innerHTML = "";

    courseEmpty.hidden = courses.length > 0;

    courses.forEach((course, index) => {
      const item = document.createElement("div");

      item.className = "course-item";

      item.innerHTML = `
        <div class="course-item-info">
          <strong>${escapeHTML(course.code)}</strong>
          <span>${escapeHTML(course.title)}</span>
          <small>
            ${course.units}
            credit unit${course.units === 1 ? "" : "s"}
          </small>
        </div>

        <button
          type="button"
          class="remove-course-button"
          data-remove-course="${index}"
          aria-label="Remove ${escapeHTML(course.code)}"
        >
          Remove
        </button>
      `;

      courseList.appendChild(item);
    });
  }

  function addCourse() {
    hideMessage();

    const code = clean(courseCodeInput?.value).toUpperCase();
    const title = clean(courseTitleInput?.value);
    const units = Number(courseUnitsInput?.value);

    if (!code || !title || !courseUnitsInput?.value) {
      showMessage("Please complete all course details.");
      return;
    }

    if (!Number.isInteger(units) || units < 1 || units > 30) {
      showMessage("Credit units must be between 1 and 30.");
      return;
    }

    if (courses.some(course => course.code === code)) {
      showMessage("This course has already been added.");
      return;
    }

    courses.push({
      code,
      title,
      units
    });

    courseCodeInput.value = "";
    courseTitleInput.value = "";
    courseUnitsInput.value = "";

    renderCourses();
  }

  addCourseButton?.addEventListener("click", addCourse);

  courseList?.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-course]");

    if (!button) return;

    const index = Number(button.dataset.removeCourse);

    if (!Number.isInteger(index)) return;

    courses.splice(index, 1);

    renderCourses();
  });

  // =====================================
  // 6. LOAD AUTHENTICATED USER
  // =====================================

  try {
    const session = await window.orbitAuth.getSession();

    if (!session?.user) {
      window.location.replace("login.html");
      return;
    }

    currentUser = session.user;

    // Prefill signup information.
    const signupName =
      currentUser.user_metadata?.full_name || "";

    if (fullNameInput && signupName) {
      fullNameInput.value = signupName;
    }

    if (displayNameInput && signupName) {
      displayNameInput.value = signupName.split(" ")[0];
    }

    // =====================================
    // 7. LOAD EXISTING PROFILE
    // =====================================

    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile) {
      if (displayNameInput) {
        displayNameInput.value =
          profile.display_name || displayNameInput.value;
      }

      if (fullNameInput) {
        fullNameInput.value =
          profile.full_name || fullNameInput.value;
      }

      if (institutionInput) {
        institutionInput.value = profile.university || "";
      }

      if (facultyInput) {
        facultyInput.value = profile.faculty || "";
      }

      if (departmentInput) {
        departmentInput.value = profile.department || "";
      }

      if (programmeInput) {
        programmeInput.value = profile.programme || "";
      }

      if (studyLevelInput) {
        studyLevelInput.value = profile.study_level || "";
      }

      if (sessionInput) {
        sessionInput.value = profile.academic_session || "";
      }

      if (semesterInput) {
        semesterInput.value = profile.semester || "";
      }

      const theme = profile.theme || "light";

      const themeInput = $(
        `input[name="theme"][value="${theme}"]`
      );

      if (themeInput) {
        themeInput.checked = true;
      }

      applyTheme(theme);

      // Load existing courses.
      const { data: savedCourses, error: coursesError } =
        await supabase
          .from("student_courses")
          .select("code, title, units")
          .eq("user_id", currentUser.id)
          .order("code");

      if (coursesError) throw coursesError;

      courses = (savedCourses || []).map(course => ({
        code: course.code,
        title: course.title,
        units: course.units
      }));
    }

    renderCourses();
    updateThemeSelection();

  } catch (error) {
    console.error("ORBIT profile loading error:", error);

    showMessage(
      "We couldn't load your details. Please refresh and try again."
    );

    return;
  }

  // =====================================
  // 8. SAVE PROFILE
  // =====================================

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    hideMessage();

    if (!currentUser) {
      showMessage("Your session has expired. Please log in again.");
      return;
    }

    const profileData = {
      user_id: currentUser.id,

      display_name: clean(displayNameInput?.value),
      full_name: clean(fullNameInput?.value),

      university: clean(institutionInput?.value),
      faculty: clean(facultyInput?.value),
      department: clean(departmentInput?.value),

      programme: clean(programmeInput?.value),
      study_level: clean(studyLevelInput?.value),

      academic_session: clean(sessionInput?.value),
      semester: clean(semesterInput?.value),

      theme: getSelectedTheme(),
      setup_completed: true
    };

    // Validate required fields.
    const requiredFields = [
      ["display name", profileData.display_name],
      ["full name", profileData.full_name],
      ["institution", profileData.university],
      ["faculty", profileData.faculty],
      ["department", profileData.department],
      ["programme", profileData.programme],
      ["study level", profileData.study_level],
      ["academic session", profileData.academic_session],
      ["semester", profileData.semester]
    ];

    const missing = requiredFields.find(([, value]) => !value);

    if (missing) {
      showMessage(`Please complete your ${missing[0]}.`);
      return;
    }

    if (courses.length === 0) {
      showMessage("Please add at least one course.");
      return;
    }

    setLoading(true);

    try {
      // Save profile.
      const { error: profileSaveError } = await supabase
        .from("student_profiles")
        .upsert(profileData, {
          onConflict: "user_id"
        });

      if (profileSaveError) throw profileSaveError;

      // Save courses.
      const courseRows = courses.map(course => ({
        user_id: currentUser.id,
        code: course.code,
        title: course.title,
        units: course.units
      }));

      const { error: courseSaveError } = await supabase
        .from("student_courses")
        .upsert(courseRows, {
          onConflict: "user_id,code"
        });

      if (courseSaveError) throw courseSaveError;

      // Remove courses deleted during editing.
      const { data: existingCourses, error: existingError } =
        await supabase
          .from("student_courses")
          .select("code")
          .eq("user_id", currentUser.id);

      if (existingError) throw existingError;

      const selectedCodes = new Set(
        courses.map(course => course.code)
      );

      const obsoleteCodes = (existingCourses || [])
        .map(course => course.code)
        .filter(code => !selectedCodes.has(code));

      if (obsoleteCodes.length > 0) {
        const { error: deleteError } = await supabase
          .from("student_courses")
          .delete()
          .eq("user_id", currentUser.id)
          .in("code", obsoleteCodes);

        if (deleteError) throw deleteError;
      }

      // Persist theme.
      applyTheme(profileData.theme);

      showMessage(
        "Your ORBIT profile is ready. Welcome aboard!",
        "success"
      );

      setTimeout(() => {
        window.location.href = "app.html";
      }, 1000);

    } catch (error) {
      console.error("ORBIT profile saving error:", error);

      showMessage(
        error.message || "We couldn't save your details. Please try again."
      );

    } finally {
      setLoading(false);
    }
  });

  renderCourses();
  updateThemeSelection();

  console.log("ORBIT onboarding engine ready.");
});