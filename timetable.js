
/* =========================================
   ORBIT — TIMETABLE ENGINE
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const elements = {
    studentAvatar: $("#studentAvatar"),
    studentName: $("#studentName"),
    studentProgramme: $("#studentProgramme"),
    academicSession: $("#academicSession"),
    academicSemester: $("#academicSemester"),

    weekRange: $("#weekRange"),
    previousWeek: $("#previousWeek"),
    todayButton: $("#todayButton"),
    nextWeek: $("#nextWeek"),

    eventCount: $("#eventCount"),
    weekGrid: $("#weekGrid"),
    scheduleEmpty: $("#scheduleEmpty"),

    eventForm: $("#eventForm"),
    eventTitle: $("#eventTitle"),
    eventCourse: $("#eventCourse"),
    eventType: $("#eventType"),
    eventDay: $("#eventDay"),
    eventStart: $("#eventStart"),
    eventEnd: $("#eventEnd"),
    eventLocation: $("#eventLocation"),
    eventMessage: $("#eventMessage"),
    saveEventButton: $("#saveEventButton")
  };

  const days = [
    { number: 1, name: "Monday" },
    { number: 2, name: "Tuesday" },
    { number: 3, name: "Wednesday" },
    { number: 4, name: "Thursday" },
    { number: 5, name: "Friday" },
    { number: 6, name: "Saturday" },
    { number: 0, name: "Sunday" }
  ];

  let currentUser = null;
  let studentCourses = [];
  let timetableEvents = [];
  let currentWeek = getMonday(new Date());

  /* ==================================
     BASIC HELPERS
  ================================== */

  function setText(element, value, fallback = "—") {
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
      .join("") || "O";
  }

  function showMessage(message, type = "error") {
    if (!elements.eventMessage) return;

    elements.eventMessage.textContent = message;
    elements.eventMessage.className =
      `form-message show ${type}`;
  }

  function clearMessage() {
    if (!elements.eventMessage) return;

    elements.eventMessage.textContent = "";
    elements.eventMessage.className = "form-message";
  }

  function setLoading(isLoading) {
    if (!elements.saveEventButton) return;

    elements.saveEventButton.disabled = isLoading;

    elements.saveEventButton.textContent = isLoading
      ? "Saving activity..."
      : "Add to timetable";
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[character];
    });
  }

  function getMonday(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);

    const day = result.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + difference);

    return result;
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function formatDate(date, options = {}) {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }

  function formatTime(time) {
    if (!time) return "";

    const [hours, minutes] = time.split(":").map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function getDayName(number) {
    return days.find((day) => day.number === number)?.name || "";
  }

  /* ==================================
     THEME
  ================================== */

  function applyTheme(theme) {
    const selectedTheme =
      theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute(
      "data-theme",
      selectedTheme
    );

    localStorage.setItem("orbitTheme", selectedTheme);
  }

  /* ==================================
     PROFILE
  ================================== */

  function displayStudent(profile) {
    const name =
      profile.display_name ||
      profile.full_name ||
      "Student";

    setText(elements.studentName, name);

    setText(
      elements.studentProgramme,
      profile.programme
    );

    setText(
      elements.academicSession,
      profile.academic_session
    );

    setText(
      elements.academicSemester,
      profile.semester
    );

    if (elements.studentAvatar) {
      elements.studentAvatar.textContent =
        getInitials(name);
    }

    applyTheme(profile.theme);
  }

  /* ==================================
     LOAD COURSES
  ================================== */

  async function loadCourses() {
    const { data, error } = await window.orbitSupabase
      .from("student_courses")
      .select("code, title, units")
      .eq("user_id", currentUser.id)
      .order("code", { ascending: true });

    if (error) throw error;

    studentCourses = data || [];

    populateCourseOptions();
  }

  function populateCourseOptions() {
    if (!elements.eventCourse) return;

    elements.eventCourse.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "No linked course";
    elements.eventCourse.appendChild(defaultOption);

    studentCourses.forEach((course) => {
      const option = document.createElement("option");

      option.value = course.code;
      option.textContent =
        `${course.code} — ${course.title}`;

      elements.eventCourse.appendChild(option);
    });
  }

  /* ==================================
     LOAD TIMETABLE EVENTS
  ================================== */

  async function loadEvents() {
    if (elements.weekGrid) {
      elements.weekGrid.innerHTML = `
        <div class="schedule-loading">
          <div class="loading-spinner"></div>
          Loading your timetable...
        </div>
      `;
    }

    const { data, error } = await window.orbitSupabase
      .from("timetable_events")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("start_time", { ascending: true });

    if (error) throw error;

    timetableEvents = data || [];

    renderTimetable();
  }

  /* ==================================
     WEEK NAVIGATION
  ================================== */

  function updateWeekHeading() {
    if (!elements.weekRange) return;

    const weekEnd = addDays(currentWeek, 6);

    const startText = formatDate(currentWeek, {
      day: "numeric",
      month: "short"
    });

    const endText = formatDate(weekEnd, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    elements.weekRange.textContent =
      `${startText} – ${endText}`;
  }

  function changeWeek(amount) {
    currentWeek = addDays(currentWeek, amount * 7);

    renderTimetable();
  }

  /* ==================================
     RENDER TIMETABLE
  ================================== */

  function renderTimetable() {
    if (!elements.weekGrid) return;

    updateWeekHeading();

    elements.weekGrid.innerHTML = "";

    let totalEvents = 0;

    const today = new Date();

    const todayKey = [
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ].join("-");

    days.forEach((day, index) => {
      const date = addDays(
        currentWeek,
        index
      );

      const dateKey = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ].join("-");

      const isToday = dateKey === todayKey;

      const dayEvents = timetableEvents
        .filter((event) => Number(event.day_of_week) === day.number)
        .sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );

      totalEvents += dayEvents.length;

      const column = document.createElement("section");

      column.className =
        `day-column${isToday ? " today" : ""}`;

      const heading = document.createElement("div");
      heading.className = "day-heading";

      const dayTitle = document.createElement("strong");
      dayTitle.textContent = day.name.slice(0, 3);

      const dateText = document.createElement("span");
      dateText.textContent = formatDate(date, {
        day: "numeric",
        month: "short"
      });

      heading.append(dayTitle, dateText);

      const eventsContainer = document.createElement("div");
      eventsContainer.className = "day-events";

      dayEvents.forEach((event) => {
        eventsContainer.appendChild(
          createEventCard(event)
        );
      });

      column.append(heading, eventsContainer);
      elements.weekGrid.appendChild(column);
    });

    setText(
      elements.eventCount,
      `${totalEvents} ${totalEvents === 1 ? "activity" : "activities"}`
    );

    if (elements.scheduleEmpty) {
      elements.scheduleEmpty.hidden =
        timetableEvents.length > 0;
    }
  }

  /* ==================================
     EVENT CARD
  ================================== */

  function createEventCard(event) {
    const card = document.createElement("article");

    card.className = "schedule-event";

    const title = document.createElement("strong");
    title.textContent = event.title;

    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent =
      `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`;

    const location = document.createElement("span");
    location.className = "event-location";
    location.textContent = event.location || "Location not added";

    const type = document.createElement("span");
    type.className = "event-type";
    type.textContent = event.event_type || "Other";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "event-delete-button";
    deleteButton.textContent = "Remove";
    deleteButton.setAttribute(
      "aria-label",
      `Remove ${event.title}`
    );

    deleteButton.addEventListener("click", () => {
      deleteEvent(event.id, deleteButton);
    });

    card.append(
      title,
      time,
      location,
      type,
      deleteButton
    );

    return card;
  }

  /* ==================================
     ADD EVENT
  ================================== */

  async function addEvent(event) {
    const title = elements.eventTitle.value.trim();
    const courseCode = elements.eventCourse.value || null;
    const eventType = elements.eventType.value;
    const day = Number(elements.eventDay.value);
    const startTime = elements.eventStart.value;
    const endTime = elements.eventEnd.value;
    const location = elements.eventLocation.value.trim() || null;

    if (!title || !startTime || !endTime) {
      showMessage("Please complete the required fields.");
      return;
    }

    if (endTime <= startTime) {
      showMessage("End time must be later than start time.");
      return;
    }

    const allowedTypes = [
      "Lecture",
      "Practical",
      "Tutorial",
      "Study",
      "Other"
    ];

    if (!allowedTypes.includes(eventType)) {
      showMessage("Please select a valid activity type.");
      return;
    }

    if (!days.some((item) => item.number === day)) {
      showMessage("Please select a valid day.");
      return;
    }

    setLoading(true);
    clearMessage();

    try {
      const { data, error } = await window.orbitSupabase
        .from("timetable_events")
        .insert({
          user_id: currentUser.id,
          title,
          course_code: courseCode,
          event_type: eventType,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          location
        })
        .select()
        .single();

      if (error) throw error;

      timetableEvents.push(data);

      elements.eventForm.reset();

      renderTimetable();

      showMessage("Activity added to your timetable!", "success");

    } catch (error) {
      console.error("ORBIT timetable save:", error);

      showMessage(
        error.message ||
        "We couldn't save that activity. Please try again."
      );

    } finally {
      setLoading(false);
    }
  }

  /* ==================================
     DELETE EVENT
  ================================== */

  async function deleteEvent(id, button) {
    const confirmed = window.confirm(
      "Remove this activity from your timetable?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Removing...";

    try {
      const { error } = await window.orbitSupabase
        .from("timetable_events")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      timetableEvents = timetableEvents.filter(
        (event) => event.id !== id
      );

      renderTimetable();

    } catch (error) {
      console.error("ORBIT timetable delete:", error);

      button.disabled = false;
      button.textContent = "Remove";

      showMessage(
        "We couldn't remove that activity. Please try again."
      );
    }
  }

  /* ==================================
     EVENT LISTENERS
  ================================== */

  elements.eventForm?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      addEvent(event);
    }
  );

  elements.previousWeek?.addEventListener(
    "click",
    () => changeWeek(-1)
  );

  elements.nextWeek?.addEventListener(
    "click",
    () => changeWeek(1)
  );

  elements.todayButton?.addEventListener(
    "click",
    () => {
      currentWeek = getMonday(new Date());
      renderTimetable();
    }
  );

  /* ==================================
     INITIALISE
  ================================== */

  async function initialise() {
    if (!window.orbitAuth || !window.orbitSupabase) {
      window.location.href = "login.html";
      return;
    }

    try {
      const session = await window.orbitAuth.getSession();

      if (!session) {
        window.location.href = "login.html";
        return;
      }

      currentUser = session.user;

      const { data: profile, error } = await window.orbitSupabase
        .from("student_profiles")
        .select(`
          display_name,
          full_name,
          programme,
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

      displayStudent(profile);

      await loadCourses();
      await loadEvents();

    } catch (error) {
      console.error("ORBIT timetable initialisation:", error);

      if (elements.weekGrid) {
        elements.weekGrid.innerHTML = `
          <div class="schedule-empty">
            <strong>Something went wrong</strong>
            We couldn't load your timetable. Please refresh the page.
          </div>
        `;
      }
    }
  }

  initialise();
});
