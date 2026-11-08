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

  const profileInitials = $("#profileInitials");
  const topbarAvatar = $("#topbarAvatar");
  const profileLargeAvatar = $("#profileLargeAvatar");

  const courseList = $("#dashboardCourseList");
  const todayDate = $("#todayDate");
  const currentYear = $("#currentYear");
const dashboardTimetableList = $("#dashboardTimetableList");
  // =========================================
  // HELPERS
  // =========================================

  function setText(selector, value, fallback = "Not provided") {
    const element = $(selector);
    if (element) element.textContent = value || fallback;
  }

  function getInitials(name) {
    return String(name || "ORBIT")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("") || "O";
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
  // LIVE DATE & CLOCK
  // =========================================

  let clockElement = document.querySelector("#liveClock");

  if (!clockElement && todayDate) {
    clockElement = document.createElement("span");
    clockElement.id = "liveClock";
    clockElement.className = "live-clock";
    clockElement.setAttribute("aria-live", "off");

    todayDate.insertAdjacentElement("afterend", clockElement);
  }

  function displayDateTime() {
    const now = new Date();

    if (todayDate) {
      todayDate.textContent = new Intl.DateTimeFormat("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);
    }

    if (clockElement) {
      clockElement.textContent = new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }).format(now);
    }

    if (currentYear) {
      currentYear.textContent = now.getFullYear();
    }
  }

  displayDateTime();

  // Keep the clock running and refresh when the page becomes active.
  const clockInterval = setInterval(displayDateTime, 1000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) displayDateTime();
  });

  window.addEventListener("focus", displayDateTime);

  // =========================================
  // AUTHENTICATION
  // =========================================

  if (!window.orbitAuth || !window.orbitSupabase) {
    showToast("ORBIT couldn't connect. Please refresh.", "error");
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

      themeButton.title =
        selectedTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme";
    }

    const themeColor = $('meta[name="theme-color"]');

    if (themeColor) {
      themeColor.content =
        selectedTheme === "dark" ? "#19171e" : "#f8f6f1";
    }

    return selectedTheme;
  }

  // Apply saved device preference immediately.
  applyTheme(localStorage.getItem("orbitTheme") || "light");

  async function saveTheme(theme) {
    if (!currentUser) return;

    const { error } = await supabase
      .from("student_profiles")
      .update({ theme })
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Theme sync error:", error);
      showToast("Theme saved on this device, but couldn't sync.", "error");
    } else if (currentProfile) {
      currentProfile.theme = theme;
    }
  }

  if (themeButton) {
    themeButton.addEventListener("click", async () => {
      const nextTheme =
        document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";

      applyTheme(nextTheme);
      await saveTheme(nextTheme);
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
    overlay.setAttribute("aria-hidden", "true");
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
    if (event.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 680) closeSidebar();
  });

  // =========================================
  // PAGE NAVIGATION
  // =========================================

  const pageRoutes = {
    "#academics": "academics.html",
    "#schedule": "timetable.html",
    "#profile": "profile.html",
    "#community": "community.html",
    "#marketplace": "marketplace.html",
    "#opportunities": "opportunities.html"
  };

  // Update destinations BEFORE attaching click listeners.
  document.querySelectorAll(".nav-link").forEach(link => {
    const destination = link.getAttribute("href");

    if (pageRoutes[destination]) {
      link.setAttribute("href", pageRoutes[destination]);
      link.removeAttribute("data-coming-soon");
    }
  });

  // Sidebar navigation.
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", event => {
      const href = link.getAttribute("href");

      closeSidebar();

      // Only handle dashboard section links here.
      if (href && href.startsWith("#")) {
        const target = document.querySelector(href);

        if (target) {
          event.preventDefault();

          document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
          });

          link.classList.add("active");

          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }

      // Inform users about unfinished modules.
      if (link.hasAttribute("data-coming-soon")) {
        event.preventDefault();
        showToast("This ORBIT feature is coming soon.");
      }
    });
  });

  // Quick dashboard shortcuts.
  document.querySelectorAll(".quick-card").forEach(link => {
    link.addEventListener("click", event => {
      const href = link.getAttribute("href");

      if (!href || !href.startsWith("#")) return;

      const target = document.querySelector(href);

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
    const result = await window.orbitAuth.getSession();

    const session =
      result?.data?.session ||
      result?.session ||
      result;

    if (!session?.user) {
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
    const fullName = profile.full_name || "ORBIT Student";

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

    if (profileInitials) profileInitials.textContent = initials;
    if (topbarAvatar) topbarAvatar.textContent = initials;
    if (profileLargeAvatar) profileLargeAvatar.textContent = initials;

    // Database preference takes priority.
    if (profile.theme) {
      applyTheme(profile.theme);
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
/* ==================================
   LOAD DASHBOARD TIMETABLE
================================== */

async function loadDashboardTimetable() {
  const container = dashboardTimetableList;

  if (!container) return;

  container.innerHTML = `
    <p class="schedule-loading">Loading your timetable...</p>
  `;

  try {
    const { data, error } = await window.orbitSupabase
      .from("timetable_events")
      .select("id, title, course_code, event_type, day_of_week, start_time, end_time, location")
      .eq("user_id", currentUser.id)
      .order("start_time", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="schedule-empty">
          <strong>No activities scheduled yet.</strong>
          <p>Your saved lectures and activities will appear here.</p>
          <a href="timetable.html">Create your timetable</a>
        </div>
      `;
      return;
    }

    const dayNames = {
      0: "Sunday",
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday"
    };

    const today = new Date().getDay();

    const sortedEvents = [...data].sort((a, b) => {
      const dayA = (Number(a.day_of_week) - today + 7) % 7;
      const dayB = (Number(b.day_of_week) - today + 7) % 7;

      return dayA - dayB ||
        a.start_time.localeCompare(b.start_time);
    });

    container.innerHTML = sortedEvents.map(event => {
      const start = formatDashboardTime(event.start_time);
      const end = formatDashboardTime(event.end_time);

      return `
        <article class="dashboard-timetable-item">
          <div class="dashboard-timetable-time">
            <strong>${start}</strong>
            <span>${end}</span>
          </div>

          <div class="dashboard-timetable-details">
            <strong>${escapeDashboardHTML(event.title)}</strong>
            <span>
              ${dayNames[event.day_of_week] || "Unknown day"}
              ${event.course_code ? ` · ${escapeDashboardHTML(event.course_code)}` : ""}
            </span>
            <small>
              ${escapeDashboardHTML(event.location || "Location not added")}
              · ${escapeDashboardHTML(event.event_type || "Other")}
            </small>
          </div>
        </article>
      `;
    }).join("");

  } catch (error) {
    console.error("Dashboard timetable error:", error);

    container.innerHTML = `
      <p class="schedule-error">
        Couldn't load your timetable. Please refresh.
      </p>
    `;
  }
}

function formatDashboardTime(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeDashboardHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}
  // =========================================
  // RENDER COURSES
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

      const badge = document.createElement("div");
      badge.className = "course-code-badge";
      badge.textContent = course.code || "N/A";

      const info = document.createElement("div");
      info.className = "course-row-info";

      const title = document.createElement("strong");
      title.textContent = course.title || "Untitled course";

      const code = document.createElement("span");
      code.textContent = course.code || "";

      info.append(title, code);

      const units = document.createElement("span");
      units.className = "course-unit-badge";

      const unitCount = Number(course.units || 0);

      units.textContent =
        `${unitCount} unit${unitCount === 1 ? "" : "s"}`;

      row.append(badge, info, units);
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
        const result = await window.orbitAuth.signOut();

        if (result?.error) throw result.error;

        window.location.replace("login.html");

      } catch (error) {
        console.error("ORBIT sign-out error:", error);

        showToast("Couldn't sign you out. Please try again.", "error");

        signOutButton.disabled = false;
        signOutButton.textContent = "↗ Sign out";
      }
    });
  }

  // =========================================
  // INITIALISE DASHBOARD
  // =========================================

  try {
    const ready = await loadStudent();
if (!ready) return;

displayStudent(currentProfile);

await loadCourses();
await loadDashboardTimetable();

    console.log("ORBIT dashboard successfully loaded.");

  } catch (error) {
    console.error("ORBIT dashboard error:", error);

    showToast(
      "We couldn't load your dashboard. Please refresh.",
      "error"
    );
  }

});