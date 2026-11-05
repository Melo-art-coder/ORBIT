
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // =========================================
  // ELEMENTS
  // =========================================

  const $ = selector => document.querySelector(selector);

  const sidebar = $("#sidebar");
  const menuButton = $("#mobileMenuButton");
  const themeButton = $("#themeToggle");
  const signOutButton = $("#signOutButton");

  const profileName = $("#profileName");
  const institutionName = $("#institutionName");
  const profileInitials = $("#profileInitials");
  const topbarAvatar = $("#topbarAvatar");
  const profileLargeAvatar = $("#profileLargeAvatar");

  const studentGreeting = $("#studentGreeting");
  const dashboardInstitution = $("#dashboardInstitution");
  const dashboardProgramme = $("#dashboardProgramme");
  const dashboardLevel = $("#dashboardLevel");
  const dashboardSession = $("#dashboardSession");
  const currentSemester = $("#currentSemester");

  const profileFullName = $("#profileFullName");
  const profileProgramme = $("#profileProgramme");
  const profileDepartment = $("#profileDepartment");

  const courseCount = $("#courseCount");
  const creditCount = $("#creditCount");
  const coursePanelCount = $("#coursePanelCount");
  const courseList = $("#dashboardCourseList");

  const todayDate = $("#todayDate");
  const currentYear = $("#currentYear");


  // =========================================
  // BASIC HELPERS
  // =========================================

  function setText(selector, value, fallback = "Not provided") {
    const element = $(selector);

    if (element) {
      element.textContent = value || fallback;
    }
  }

  function getInitials(name) {
    const words = String(name || "ORBIT")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return "O";

    return words
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("");
  }

  function showToast(message, type = "info") {
    let toast = $("#orbitToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "orbitToast";
      toast.className = "orbit-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("visible");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
      toast.classList.remove("visible");
    }, 3000);
  }


  // =========================================
  // DATE
  // =========================================

  function displayDate() {
    const now = new Date();

    if (todayDate) {
      todayDate.textContent = new Intl.DateTimeFormat(
        "en-NG",
        {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      ).format(now);
    }

    if (currentYear) {
      currentYear.textContent = now.getFullYear();
    }
  }

  displayDate();


  // =========================================
  // AUTHENTICATION CHECK
  // =========================================

  if (!window.orbitAuth || !window.orbitSupabase) {
    showToast("ORBIT could not connect. Please refresh.", "error");
    return;
  }

  const supabase = window.orbitSupabase;

  let currentUser = null;
  let currentProfile = null;


  // =========================================
  // THEME SYSTEM
  // =========================================

  function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = selectedTheme;

    localStorage.setItem("orbitTheme", selectedTheme);

    if (themeButton) {
      themeButton.textContent =
        selectedTheme === "dark" ? "☀" : "☾";

      themeButton.setAttribute(
        "aria-label",
        selectedTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      );
    }

    const themeColor = document.querySelector(
      'meta[name="theme-color"]'
    );

    if (themeColor) {
      themeColor.content =
        selectedTheme === "dark" ? "#19171e" : "#f8f6f1";
    }
  }

  let savedTheme = localStorage.getItem("orbitTheme") || "light";

  applyTheme(savedTheme);

  if (themeButton) {
    themeButton.addEventListener("click", async () => {
      const nextTheme =
        document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";

      applyTheme(nextTheme);

      if (!currentUser) return;

      const { error } = await supabase
        .from("student_profiles")
        .update({ theme: nextTheme })
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("Theme save error:", error);
        showToast("Theme changed on this device, but couldn't sync.", "error");
      }
    });
  }


  // =========================================
  // MOBILE SIDEBAR
  // =========================================

  let overlay = $("#sidebarOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "sidebar-overlay";

    document.body.appendChild(overlay);
  }

  function openSidebar() {
    if (!sidebar || !menuButton) return;

    sidebar.classList.add("open");
    menuButton.classList.add("active");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close navigation");

    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    if (!sidebar || !menuButton) return;

    sidebar.classList.remove("open");
    menuButton.classList.remove("active");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");

    overlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      sidebar?.classList.contains("open")
        ? closeSidebar()
        : openSidebar();
    });
  }

  overlay.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 680) {
      closeSidebar();
    }
  });


  // =========================================
  // NAVIGATION
  // =========================================

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      const target = document.querySelector(
        link.getAttribute("href")
      );

      document.querySelectorAll(".nav-link").forEach(item => {
        item.classList.remove("active");
      });

      link.classList.add("active");

      closeSidebar();

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      if (
        link.querySelector(".coming-soon") ||
        ["community", "marketplace", "opportunities"].includes(
          link.getAttribute("href")?.replace("#", "")
        )
      ) {
        showToast("This ORBIT module is still being developed.");
      }
    });
  });

  document.querySelectorAll(".quick-card").forEach(link => {
    link.addEventListener("click", event => {
      const target = document.querySelector(
        link.getAttribute("href")
      );

      if (target) {
        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });


  // =========================================
  // LOAD STUDENT PROFILE
  // =========================================

  async function loadStudent() {
    const session = await window.orbitAuth.getSession();

    if (!session || !session.user) {
      window.location.replace("login.html");
      return false;
    }

    currentUser = session.user;

    const { data: profile, error } = await supabase
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

    if (!profile || profile.setup_completed !== true) {
      window.location.replace("setup.html");
      return false;
    }

    currentProfile = profile;

    return true;
  }


  // =========================================
  // DISPLAY STUDENT INFORMATION
  // =========================================

  function displayStudent(profile) {
    const fullName =
      profile.full_name || "ORBIT Student";

    const displayName =
      profile.display_name || fullName.split(" ")[0];

    const initials = getInitials(fullName);

    setText("#profileName", displayName);
    setText("#institutionName", profile.university);

    setText("#studentGreeting", displayName);

    setText("#dashboardInstitution", profile.university);
    setText("#dashboardProgramme", profile.programme);
    setText("#dashboardLevel", profile.study_level);
    setText("#dashboardSession", profile.academic_session);

    setText("#currentSemester", profile.semester);

    setText("#profileFullName", fullName);
    setText("#profileProgramme", profile.programme);
    setText("#profileDepartment", profile.department);

    if (profileInitials) {
      profileInitials.textContent = initials;
    }

    if (topbarAvatar) {
      topbarAvatar.textContent = initials;
    }

    if (profileLargeAvatar) {
      profileLargeAvatar.textContent = initials;
    }

    // Use the database preference as the source of truth.
    if (profile.theme) {
      savedTheme = profile.theme;
      applyTheme(savedTheme);
    }
  }


  // =========================================
  // LOAD STUDENT COURSES
  // =========================================

  async function loadCourses() {
    const { data: courses, error } = await supabase
      .from("student_courses")
      .select("id, code, title, units")
      .eq("user_id", currentUser.id)
      .order("code", { ascending: true });

    if (error) throw error;

    const studentCourses = courses || [];

    const totalUnits = studentCourses.reduce(
      (total, course) => total + Number(course.units || 0),
      0
    );

    setText("#courseCount", studentCourses.length, "0");
    setText("#creditCount", totalUnits, "0");

    setText(
      "#coursePanelCount",
      `${studentCourses.length} course${studentCourses.length === 1 ? "" : "s"}`
    );

    renderCourses(studentCourses);
  }


  // =========================================
  // RENDER COURSES SAFELY
  // =========================================

  function renderCourses(courses) {
    if (!courseList) return;

    courseList.replaceChildren();

    if (!courses.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";

      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.textContent = "▤";

      const heading = document.createElement("strong");
      heading.textContent = "No courses found";

      const description = document.createElement("p");
      description.textContent =
        "Add your courses through your student setup.";

      empty.append(icon, heading, description);
      courseList.appendChild(empty);

      return;
    }

    courses.forEach(course => {
      const row = document.createElement("article");
      row.className = "course-row";

      const codeBadge = document.createElement("div");
      codeBadge.className = "course-code-badge";
      codeBadge.textContent = course.code || "N/A";

      const info = document.createElement("div");
      info.className = "course-row-info";

      const title = document.createElement("strong");
      title.textContent = course.title || "Untitled course";

      const code = document.createElement("span");
      code.textContent = course.code || "";

      info.append(title, code);

      const units = document.createElement("span");
      units.className = "course-unit-badge";
      units.textContent = `${course.units} unit${Number(course.units) === 1 ? "" : "s"}`;

      row.append(codeBadge, info, units);

      courseList.appendChild(row);
    });
  }


  // =========================================
  // SIGN OUT
  // =========================================

  if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Are you sure you want to sign out of ORBIT?"
      );

      if (!confirmed) return;

      signOutButton.disabled = true;
      signOutButton.textContent = "Signing out...";

      try {
        await window.orbitAuth.signOut();
      } catch (error) {
        console.error("ORBIT sign-out error:", error);

        showToast("Couldn't sign you out. Please try again.", "error");

        signOutButton.disabled = false;
        signOutButton.textContent = "↗ Sign out";
      }
    });
  }
  //===============
  //ACADEMICS PAGE NAVIGATION
  //================
  document.querySelectorAll(
    'a[href="#academics"]'
  ).forEach((link)=>{
    link.setAttribute("href", "academics.html");
    link.removeAttribute("data-coming-soon");
  });

  //===============
  //TIMETABLE PAGE NAVIGATION
  //===============
  document.querySelectorAll(
    'a[href="#schedule"]'
  ).forEach((link)=> {
    link.setAttribute("href","timetable.html");
    link.removeAttribute("data-coming-soon");
  });

  //===============
  //PROFILE PAGE NAVIGATION
  //===============
  document.querySelectorAll(
    'a[href="#profile"]'
  ).forEach((link)=> {
    link.setAttribute("href", "profile.html");
    link.removeAttribute("data-coming-soon");
  });

  //=========================
  //COMMUNITY PAGE NAVIGATION
  //=========================

  document.querySelectorAll(
    'a[href="#community"]'
  ).forEach((link)=>{
    link.setAttribute("href", "community.html");
    link.removeAttribute("data-coming-soon");
  }
  );
  
  // =========================================
  // INITIALISE DASHBOARD
  // =========================================

  try {
    const ready = await loadStudent();

    if (!ready) return;

    displayStudent(currentProfile);

    await loadCourses();

    console.log("ORBIT dashboard successfully loaded.");

  } catch (error) {
    console.error("ORBIT dashboard error:", error);

    showToast(
      "We couldn't load your dashboard. Please refresh.",
      "error"
    );
  }

});
