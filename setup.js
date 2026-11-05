
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const form = document.querySelector("#setupForm");
  const message = document.querySelector("#setupMessage");
  const finishButton = document.querySelector("#finishSetupButton");
  const courseList = document.querySelector("#courseList");
  const courseEmpty = document.querySelector("#courseEmpty");

  const displayNameInput = document.querySelector("#displayName");
  const fullNameInput = document.querySelector("#fullName");
  const institutionInput = document.querySelector("#institution");
  const facultyInput = document.querySelector("#faculty");
  const departmentInput = document.querySelector("#department");
  const programmeInput = document.querySelector("#programme");
  const studyLevelInput = document.querySelector("#studyLevel");
  const sessionInput = document.querySelector("#academicSession");
  const semesterInput = document.querySelector("#semester");

  const courseCodeInput = document.querySelector("#courseCode");
  const courseTitleInput = document.querySelector("#courseTitle");
  const courseUnitsInput = document.querySelector("#courseUnits");
  const addCourseButton = document.querySelector("#addCourseButton");

  const yearElement = document.querySelector("#currentYear");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  let courses = [];
  let currentUser = null;
  let profileExists = false;

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

  function clean(value) {
    return String(value || "").trim();
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

  function getSelectedTheme() {
    return document.querySelector(
      'input[name="theme"]:checked'
    )?.value || "light";
  }

  function updateThemeSelection() {
    document.querySelectorAll("[data-theme-option]").forEach(option => {
      const input = option.querySelector('input[name="theme"]');

      option.classList.toggle(
        "selected",
        Boolean(input && input.checked)
      );
    });
  }

  document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener("change", updateThemeSelection);
  });

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
          <small>${course.units} credit unit${course.units === 1 ? "" : "s"}</small>
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
      showMessage("Please enter the course code, title and credit units.");
      return;
    }

    if (!Number.isInteger(units) || units < 1 || units > 30) {
      showMessage("Credit units must be a whole number between 1 and 30.");
      return;
    }

    if (courses.some(course => course.code.toUpperCase() === code)) {
      showMessage("That course code has already been added.");
      return;
    }

    courses.push({ code, title, units });

    courseCodeInput.value = "";
    courseTitleInput.value = "";
    courseUnitsInput.value = "";

    renderCourses();
  }

  if (addCourseButton) {
    addCourseButton.addEventListener("click", addCourse);
  }

  if (courseList) {
    courseList.addEventListener("click", event => {
      const removeButton = event.target.closest("[data-remove-course]");

      if (!removeButton) return;

      const index = Number(removeButton.dataset.removeCourse);

      if (Number.isInteger(index) && index >= 0) {
        courses.splice(index, 1);
        renderCourses();
      }
    });
  }

  // Connect to the existing ORBIT authentication client.
  if (!window.orbitAuth || !window.orbitSupabase) {
    showMessage("ORBIT could not connect to Supabase. Please refresh.");
    return;
  }

  const supabase = window.orbitSupabase;

  try {
    const session = await window.orbitAuth.getSession();

    if (!session) {
      window.location.replace("login.html");
      return;
    }

    currentUser = session.user;

    if (!currentUser) {
      window.location.replace("login.html");
      return;
    }

    // Prefill the student's name from signup.
    const signupName = currentUser.user_metadata?.full_name || "";

    if (fullNameInput && signupName) {
      fullNameInput.value = signupName;
    }

    if (displayNameInput && signupName) {
      displayNameInput.value = signupName.split(" ")[0];
    }

    // Load an existing profile if setup is being resumed.
    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile) {
      profileExists = true;

      if (displayNameInput) {
        displayNameInput.value = profile.display_name || displayNameInput.value;
      }

      if (fullNameInput) {
        fullNameInput.value = profile.full_name || fullNameInput.value;
      }

      if (institutionInput) institutionInput.value = profile.university || "";
      if (facultyInput) facultyInput.value = profile.faculty || "";
      if (departmentInput) departmentInput.value = profile.department || "";
      if (programmeInput) programmeInput.value = profile.programme || "";
      if (studyLevelInput) studyLevelInput.value = profile.study_level || "";
      if (sessionInput) sessionInput.value = profile.academic_session || "";
      if (semesterInput) semesterInput.value = profile.semester || "";

      const savedTheme = profile.theme || "light";
      const themeInput = document.querySelector(
        `input[name="theme"][value="${savedTheme}"]`
      );

      if (themeInput) themeInput.checked = true;

      const { data: savedCourses, error: coursesError } = await supabase
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

      renderCourses();
      updateThemeSelection();
    }

  } catch (error) {
    console.error("ORBIT setup loading error:", error);
    showMessage("We couldn't load your student details. Please refresh and try again.");
    return;
  }

  // Save the completed student profile.
  if (form) {
    form.addEventListener("submit", async event => {
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

      const missingField = requiredFields.find(([, value]) => !value);

      if (missingField) {
        showMessage(`Please complete your ${missingField[0]}.`);
        return;
      }

      if (courses.length === 0) {
        showMessage("Please add at least one course before continuing.");
        return;
      }

      setLoading(true);

      try {
        const { error: saveProfileError } = await supabase
          .from("student_profiles")
          .upsert(profileData, { onConflict: "user_id" });

        if (saveProfileError) throw saveProfileError;

        const courseRows = courses.map(course => ({
          user_id: currentUser.id,
          code: course.code,
          title: course.title,
          units: course.units
        }));

        const { error: saveCoursesError } = await supabase
          .from("student_courses")
          .upsert(courseRows, { onConflict: "user_id,code" });

        if (saveCoursesError) throw saveCoursesError;

        // Keep the selected theme available to the dashboard.
        localStorage.setItem("orbitTheme", profileData.theme);
        document.documentElement.dataset.theme = profileData.theme;

        showMessage("Your ORBIT profile is ready. Welcome aboard!", "success");

        setTimeout(() => {
          window.location.href = "app.html";
        }, 900);

      } catch (error) {
        console.error("ORBIT setup save error:", error);

        showMessage(
          error.message || "We couldn't save your details. Please try again."
        );

      } finally {
        setLoading(false);
      }
    });
  }

  renderCourses();
  updateThemeSelection();

  console.log("ORBIT onboarding engine ready.");
});
