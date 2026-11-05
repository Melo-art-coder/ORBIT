
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // ==================================
  // ELEMENTS
  // ==================================

  const $ = (selector) => document.querySelector(selector);

  const courseForm = $("#courseForm");
  const courseCodeInput = $("#courseCode");
  const courseTitleInput = $("#courseTitle");
  const courseUnitsInput = $("#courseUnits");
  const courseList = $("#courseList");
  const emptyState = $("#emptyState");
  const courseMessage = $("#courseMessage");
  const saveButton = $("#saveCourseButton");
  const searchInput = $("#searchCourses");

  let currentUser = null;
  let allCourses = [];
  let isSaving = false;

  // ==================================
  // HELPERS
  // ==================================

  function setText(selector, value, fallback = "—") {
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

  function showMessage(message, type = "error") {
    if (!courseMessage) return;

    courseMessage.textContent = message;
    courseMessage.className = `form-message show ${type}`;
  }

  function clearMessage() {
    if (!courseMessage) return;

    courseMessage.textContent = "";
    courseMessage.className = "form-message";
  }

  function setLoading(loading) {
    isSaving = loading;

    if (!saveButton) return;

    saveButton.disabled = loading;
    saveButton.innerHTML = loading
      ? "Saving course..."
      : "<span>+</span> Add course";
  }

  function showLoading() {
    if (!courseList) return;

    courseList.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <p>Preparing your courses...</p>
      </div>
    `;

    if (emptyState) emptyState.hidden = true;
  }

  // ==================================
  // AUTHENTICATION
  // ==================================

  async function checkAuthentication() {
    if (!window.orbitAuth || !window.orbitSupabase) {
      showMessage(
        "ORBIT could not load its authentication service. Please refresh."
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
        "We couldn't verify your account. Please refresh and try again."
      );

      return null;
    }
  }

  // ==================================
  // STUDENT PROFILE
  // ==================================

  async function loadStudentProfile() {
    const { data: profile, error } = await window.orbitSupabase
      .from("student_profiles")
      .select(`
        display_name,
        full_name,
        university,
        programme,
        study_level,
        academic_session,
        semester,
        setup_completed
      `)
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (!profile || !profile.setup_completed) {
      window.location.href = "setup.html";
      return null;
    }

    const name =
      profile.display_name ||
      profile.full_name ||
      "Student";

    setText("#studentName", name);
    setText("#studentProgramme", profile.programme);
    setText("#academicSession", profile.academic_session);
    setText("#academicSemester", profile.semester);
    setText("#studyLevel", profile.study_level);

    const avatar = $("#studentAvatar");

    if (avatar) {
      avatar.textContent = getInitials(name);
    }

    // Apply the student's saved theme.
    const theme = profile.theme ||
      localStorage.getItem("orbitTheme") ||
      "light";

    document.documentElement.dataset.theme = theme;
    localStorage.setItem("orbitTheme", theme);

    return profile;
  }

  // ==================================
  // COURSE STATISTICS
  // ==================================

  function updateStatistics() {
    const totalUnits = allCourses.reduce(
      (total, course) => total + Number(course.units || 0),
      0
    );

    setText("#courseCount", allCourses.length, "0");
    setText("#totalUnits", totalUnits, "0");

    setText(
      "#coursePanelCount",
      `${allCourses.length} ${
        allCourses.length === 1 ? "course" : "courses"
      }`
    );
  }

  // ==================================
  // RENDER COURSES
  // ==================================

  function renderCourses() {
    if (!courseList) return;

    const searchTerm = (searchInput?.value || "")
      .trim()
      .toLowerCase();

    const filteredCourses = allCourses.filter((course) => {
      return (
        course.code.toLowerCase().includes(searchTerm) ||
        course.title.toLowerCase().includes(searchTerm)
      );
    });

    courseList.replaceChildren();

    if (allCourses.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    if (filteredCourses.length === 0) {
      const noResults = document.createElement("div");

      noResults.className = "loading-state";

      const message = document.createElement("p");
      message.textContent = "No courses match your search.";

      noResults.appendChild(message);
      courseList.appendChild(noResults);

      return;
    }

    filteredCourses.forEach((course) => {
      const item = document.createElement("article");
      item.className = "course-item";

      const codeBox = document.createElement("div");
      codeBox.className = "course-code-box";
      codeBox.textContent = course.code;

      const information = document.createElement("div");
      information.className = "course-information";

      const title = document.createElement("h3");
      title.textContent = course.title;

      const code = document.createElement("p");
      code.textContent = course.code;

      information.append(title, code);

      const units = document.createElement("span");
      units.className = "course-unit-badge";
      units.textContent = `${course.units} ${
        Number(course.units) === 1 ? "unit" : "units"
      }`;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-course-button";
      removeButton.textContent = "×";
      removeButton.setAttribute(
        "aria-label",
        `Remove ${course.code}`
      );

      removeButton.addEventListener("click", () => {
        deleteCourse(course);
      });

      item.append(codeBox, information, units, removeButton);

      courseList.appendChild(item);
    });
  }

  // ==================================
  // LOAD COURSES FROM SUPABASE
  // ==================================

  async function loadCourses() {
    showLoading();

    const { data, error } = await window.orbitSupabase
      .from("student_courses")
      .select("id, code, title, units")
      .eq("user_id", currentUser.id)
      .order("code", { ascending: true });

    if (error) throw error;

    allCourses = (data || []).map((course) => ({
      ...course,
      code: String(course.code),
      title: String(course.title),
      units: Number(course.units)
    }));

    updateStatistics();
    renderCourses();
  }

  // ==================================
  // ADD A COURSE
  // ==================================

  async function addCourse(event) {
    event.preventDefault();

    if (isSaving || !currentUser) return;

    clearMessage();

    const code = courseCodeInput.value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

    const title = courseTitleInput.value.trim();
    const units = Number(courseUnitsInput.value);

    if (!code || !title || !courseUnitsInput.value) {
      showMessage("Please complete all course fields.");
      return;
    }

    if (!/^[A-Z0-9][A-Z0-9 .&/-]*$/.test(code)) {
      showMessage("Please enter a valid course code.");
      return;
    }

    if (code.length > 30 || title.length > 120) {
      showMessage("Please check the length of your course details.");
      return;
    }

    if (!Number.isInteger(units) || units < 1 || units > 30) {
      showMessage("Credit units must be between 1 and 30.");
      return;
    }

    const duplicate = allCourses.some(
      (course) => course.code.toUpperCase() === code
    );

    if (duplicate) {
      showMessage("This course is already in your course list.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await window.orbitSupabase
        .from("student_courses")
        .insert({
          user_id: currentUser.id,
          code,
          title,
          units
        })
        .select("id, code, title, units")
        .single();

      if (error) throw error;

      allCourses.push({
        ...data,
        units: Number(data.units)
      });

      allCourses.sort((a, b) =>
        a.code.localeCompare(b.code)
      );

      courseForm.reset();

      updateStatistics();
      renderCourses();

      showMessage(
        `${code} has been added successfully.`,
        "success"
      );

    } catch (error) {
      console.error("ORBIT add course error:", error);

      if (error.code === "23505") {
        showMessage("This course code already exists.");
      } else {
        showMessage(
          "We couldn't save this course. Please try again."
        );
      }

    } finally {
      setLoading(false);
    }
  }

  // ==================================
  // DELETE A COURSE
  // ==================================

  async function deleteCourse(course) {
    const confirmed = window.confirm(
      `Remove ${course.code} — ${course.title} from your courses?`
    );

    if (!confirmed) return;

    try {
      const { error } = await window.orbitSupabase
        .from("student_courses")
        .delete()
        .eq("id", course.id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      allCourses = allCourses.filter(
        (item) => item.id !== course.id
      );

      updateStatistics();
      renderCourses();

      showMessage(
        `${course.code} has been removed.`,
        "success"
      );

    } catch (error) {
      console.error("ORBIT delete course error:", error);

      showMessage(
        "We couldn't remove this course. Please try again."
      );
    }
  }

  // ==================================
  // SEARCH
  // ==================================

  if (searchInput) {
    searchInput.addEventListener("input", renderCourses);
  }

  // ==================================
  // FORM EVENTS
  // ==================================

  if (courseForm) {
    courseForm.addEventListener("submit", addCourse);
  }

  // ==================================
  // INITIALISE
  // ==================================

  const session = await checkAuthentication();

  if (!session) return;

  currentUser = session.user;

  try {
    const profile = await loadStudentProfile();

    if (!profile) return;

    await loadCourses();

  } catch (error) {
    console.error("ORBIT academics loading error:", error);

    if (courseList) {
      courseList.replaceChildren();

      const errorMessage = document.createElement("p");
      errorMessage.className = "loading-state";
      errorMessage.textContent =
        "Your courses couldn't load. Please refresh the page.";

      courseList.appendChild(errorMessage);
    }

    showMessage(
      "We couldn't load your academic information. Please try again."
    );
  }
});
