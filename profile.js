
/* =========================================
   ORBIT — PROFILE & SETTINGS ENGINE
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const elements = {
    avatar: $("#profileAvatar"),
    identityName: $("#identityName"),
    identityInstitution: $("#identityInstitution"),

    form: $("#profileForm"),

    displayName: $("#displayName"),
    fullName: $("#fullName"),
    email: $("#accountEmail"),

    institution: $("#institution"),
    faculty: $("#faculty"),
    department: $("#department"),
    programme: $("#programme"),
    studyLevel: $("#studyLevel"),
    academicSession: $("#academicSession"),
    semester: $("#semester"),

    message: $("#profileMessage"),
    saveButton: $("#saveProfileButton"),
    signOutButton: $("#signOutButton")
  };

  let currentUser = null;
  let originalProfile = null;
  let currentTheme = "light";

  /* ==================================
     HELPERS
  ================================== */

  function setMessage(message, type = "error") {
    elements.message.textContent = message;
    elements.message.className =
      `form-message show ${type}`;
  }

  function clearMessage() {
    elements.message.textContent = "";
    elements.message.className = "form-message";
  }

  function getInitials(name = "") {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "O";
  }

  function setLoading(loading) {
    elements.saveButton.disabled = loading;

    elements.saveButton.innerHTML = loading
      ? "Saving changes..."
      : 'Save changes <span>→</span>';
  }

  function applyTheme(theme) {
    const selectedTheme =
      theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute(
      "data-theme",
      selectedTheme
    );

    document.querySelectorAll(
      'input[name="theme"]'
    ).forEach((radio) => {
      radio.checked = radio.value === selectedTheme;

      const option = radio.closest(".theme-option");

      if (option) {
        option.classList.toggle(
          "selected",
          radio.checked
        );
      }
    });

    currentTheme = selectedTheme;
  }

  function getSelectedTheme() {
    return document.querySelector(
      'input[name="theme"]:checked'
    )?.value || "light";
  }

  /* ==================================
     DISPLAY PROFILE
  ================================== */

  function displayProfile(profile, user) {
    const displayName =
      profile.display_name ||
      profile.full_name ||
      "Student";

    elements.displayName.value =
      profile.display_name || "";

    elements.fullName.value =
      profile.full_name || "";

    elements.email.value =
      user.email || "";

    elements.institution.value =
      profile.university || "";

    elements.faculty.value =
      profile.faculty || "";

    elements.department.value =
      profile.department || "";

    elements.programme.value =
      profile.programme || "";

    elements.studyLevel.value =
      profile.study_level || "";

    elements.academicSession.value =
      profile.academic_session || "";

    elements.semester.value =
      profile.semester || "";

    elements.identityName.textContent =
      displayName;

    elements.identityInstitution.textContent =
      profile.university || "Institution not added";

    elements.avatar.textContent =
      getInitials(displayName);

    applyTheme(profile.theme || "light");
  }

  /* ==================================
     LOAD PROFILE
  ================================== */

  async function loadProfile() {
    const { data: sessionData, error: sessionError } =
      await window.orbitSupabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      window.location.href = "login.html";
      return;
    }

    currentUser = session.user;

    const { data: profile, error } =
      await window.orbitSupabase
        .from("student_profiles")
        .select(`
          display_name,
          full_name,
          university,
          faculty,
          department,
          programme,
          study_level,
          academic_session,
          semester,
          theme,
          setup_completed
        `)
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) throw error;

    if (!profile || !profile.setup_completed) {
      window.location.href = "setup.html";
      return;
    }

    originalProfile = profile;

    displayProfile(profile, currentUser);
  }

  /* ==================================
     LIVE THEME PREVIEW
  ================================== */

  document.querySelectorAll(
    'input[name="theme"]'
  ).forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        applyTheme(radio.value);
        clearMessage();
      }
    });
  });

  /* ==================================
     SAVE PROFILE
  ================================== */

  async function saveProfile(event) {
    event.preventDefault();
    clearMessage();

    if (!currentUser || !originalProfile) {
      setMessage("Your profile is not ready. Refresh the page.");
      return;
    }

    const updatedProfile = {
      display_name: elements.displayName.value.trim(),
      full_name: elements.fullName.value.trim(),
      university: elements.institution.value.trim(),
      faculty: elements.faculty.value.trim(),
      department: elements.department.value.trim(),
      programme: elements.programme.value.trim(),
      study_level: elements.studyLevel.value,
      academic_session: elements.academicSession.value.trim(),
      semester: elements.semester.value,
      theme: getSelectedTheme()
    };

    const requiredFields = [
      updatedProfile.display_name,
      updatedProfile.full_name,
      updatedProfile.university,
      updatedProfile.faculty,
      updatedProfile.department,
      updatedProfile.programme,
      updatedProfile.study_level,
      updatedProfile.academic_session,
      updatedProfile.semester
    ];

    if (requiredFields.some((value) => !value)) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (
      updatedProfile.display_name.length > 40 ||
      updatedProfile.full_name.length > 100 ||
      updatedProfile.university.length > 150 ||
      updatedProfile.faculty.length > 100 ||
      updatedProfile.department.length > 100 ||
      updatedProfile.programme.length > 120
    ) {
      setMessage("One or more fields exceed their allowed length.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await window.orbitSupabase
        .from("student_profiles")
        .update(updatedProfile)
        .eq("user_id", currentUser.id)
        .select()
        .single();

      if (error) throw error;

      originalProfile = data;

      const name =
        data.display_name ||
        data.full_name ||
        "Student";

      elements.identityName.textContent = name;

      elements.identityInstitution.textContent =
        data.university || "Institution not added";

      elements.avatar.textContent =
        getInitials(name);

      localStorage.setItem(
        "orbitTheme",
        updatedProfile.theme
      );

      applyTheme(updatedProfile.theme);

      setMessage(
        "Your profile has been updated successfully!",
        "success"
      );

    } catch (error) {
      console.error("ORBIT profile update:", error);

      applyTheme(currentTheme);

      setMessage(
        error.message ||
        "We couldn't save your changes. Please try again."
      );

    } finally {
      setLoading(false);
    }
  }

  /* ==================================
     SIGN OUT
  ================================== */

  async function signOut() {
    const confirmed = window.confirm(
      "Are you sure you want to sign out of ORBIT?"
    );

    if (!confirmed) return;

    elements.signOutButton.disabled = true;
    elements.signOutButton.textContent = "Signing out...";

    try {
      await window.orbitAuth.signOut();
    } catch (error) {
      console.error("ORBIT sign out:", error);

      elements.signOutButton.disabled = false;
      elements.signOutButton.textContent = "Sign out";

      setMessage(
        "We couldn't sign you out. Please try again."
      );
    }
  }

  /* ==================================
     EVENT LISTENERS
  ================================== */

  elements.form.addEventListener(
    "submit",
    saveProfile
  );

  elements.signOutButton.addEventListener(
    "click",
    signOut
  );

  /* ==================================
     INITIALISE
  ================================== */

  async function initialise() {
    if (!window.orbitAuth || !window.orbitSupabase) {
      setMessage(
        "Authentication service unavailable. Please refresh."
      );
      return;
    }

    try {
      await loadProfile();
    } catch (error) {
      console.error("ORBIT profile loading:", error);

      setMessage(
        "We couldn't load your profile. Please refresh the page."
      );
    }
  }

  initialise();
});
