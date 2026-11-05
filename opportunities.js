/* =========================================
   ORBIT — OPPORTUNITIES
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // =========================================
  // CONFIGURATION
  // =========================================

  const TABLE = "opportunities";
  const BOOKMARK_TABLE = "opportunity_bookmarks";
  const STORAGE_KEY = "orbitSavedOpportunities";
const getStorageKey = () =>
  `${STORAGE_KEY}_${currentUser?.id || "guest"}`;

  const supabase =
    window.orbitSupabase ||
    window.supabaseClient ||
    window.supabase;

  let currentUser = null;
  let opportunities = [];
  let savedIds = new Set();
  let activeCategory = "All";
  let showingSaved = false;
  let searchQuery = "";
  let currentOpportunity = null;

  // =========================================
  // ELEMENTS
  // =========================================

  const $ = selector => document.querySelector(selector);

  const elements = {
    grid: $("#opportunityGrid"),
    search: $("#opportunitySearch"),
    clearSearch: $("#clearSearch"),
    type: $("#typeFilter"),
    sort: $("#sortFilter"),

    categoryList: $("#categoryList"),

    total: $("#totalCount"),
    saved: $("#savedCount"),
    deadline: $("#deadlineCount"),
    savedBadge: $("#savedBadge"),

    resultsTitle: $("#resultsTitle"),
    resultsDescription: $("#resultsDescription"),
    resultsCount: $("#resultsCount"),

    empty: $("#emptyState"),

    savedToggle: $("#savedToggle"),
    reset: $("#resetFilters"),

    modal: $("#detailModal"),
    modalContent: $("#modalContent"),
    closeModal: $("#closeModal"),

    sidebar: $("#sidebar"),
    menu: $("#menuButton"),
    theme: $("#themeButton"),

    avatar: $("#userAvatar"),
    explore: $("#exploreButton")
  };

  // =========================================
  // HELPERS
  // =========================================

  function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== "") {
      element.textContent = text;
    }

    return element;
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === "") {
      return "Not specified";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) return String(value);

    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatDate(value) {
    if (!value) return "Not specified";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not specified";
    }

    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function daysRemaining(deadline) {
    if (!deadline) return null;

    const now = new Date();
    const end = new Date(deadline);

    if (Number.isNaN(end.getTime())) return null;

    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const lastDay = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

    return Math.ceil(
      (lastDay - today) / (1000 * 60 * 60 * 24)
    );
  }

  function getInitials(name) {
    return String(name || "ORBIT")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase() || "")
      .join("");
  }

  function getLocalSaved() {
  try {
    return JSON.parse(
      localStorage.getItem(getStorageKey()) || "[]"
    );
  } catch {
    return [];
  }
}

function setLocalSaved() {
  localStorage.setItem(
    getStorageKey(),
    JSON.stringify([...savedIds])
  );
}

  function showError(text) {
    if (!elements.grid) return;

    elements.grid.replaceChildren();

    const box = createElement(
      "div",
      "empty-state"
    );

    box.append(
      createElement("div", "empty-icon", "!"),
      createElement("h3", "", "Something went wrong."),
      createElement("p", "", text)
    );

    elements.grid.append(box);
  }

  // =========================================
  // INITIALISATION
  // =========================================

  async function initialise() {
    applyTheme();

    if (!supabase || typeof supabase.from !== "function") {
      showError(
        "ORBIT's Supabase client hasn't been connected to this page yet."
      );
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      currentUser = data.session?.user || null;

      if (!currentUser) {
        window.location.href = "login.html";
        return;
      }

      if (elements.avatar) {
        const { data: profile } = await supabase
          .from("student_profiles")
          .select("display_name, full_name")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        elements.avatar.textContent = getInitials(
          profile?.display_name ||
          profile?.full_name ||
          currentUser.email
        );
      }

      await loadSaved();
      await loadOpportunities();

      setupEvents();

    } catch (error) {
      console.error("ORBIT Opportunities:", error);

      showError(
        error.message || "Unable to load opportunities."
      );
    }
  }

  // =========================================
  // LOAD OPPORTUNITIES
  // =========================================

  async function loadOpportunities() {
    if (elements.grid) {
      elements.grid.replaceChildren(
        createElement(
          "div",
          "loading-state",
          "Loading opportunities..."
        )
      );
    }

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;

      opportunities = data || [];

      updateStatistics();
      renderOpportunities();

    } catch (error) {
      console.error("Opportunity loading:", error);

      showError(
        "We couldn't retrieve the opportunity board. Please refresh."
      );
    }
  }

  // =========================================
  // LOAD SAVED OPPORTUNITIES
  // =========================================

  async function loadSaved() {
    const localSaved = getLocalSaved();

    savedIds = new Set(localSaved);

    try {
      const { data, error } = await supabase
        .from(BOOKMARK_TABLE)
        .select("opportunity_id")
        .eq("user_id", currentUser.id);

      if (error) throw error;

      savedIds = new Set(
        (data || []).map(item => item.opportunity_id)
      );

      setLocalSaved();

    } catch (error) {
      console.warn(
        "Using locally saved bookmarks:",
        error.message
      );
    }

    updateStatistics();
  }

  // =========================================
  // STATISTICS
  // =========================================

  function updateStatistics() {
    if (elements.total) {
      elements.total.textContent = opportunities.length;
    }

    if (elements.saved) {
      elements.saved.textContent = savedIds.size;
    }

    if (elements.savedBadge) {
      elements.savedBadge.textContent = savedIds.size;
    }

    const closingSoon = opportunities.filter(item => {
      const remaining = daysRemaining(item.deadline);

      return remaining !== null &&
        remaining >= 0 &&
        remaining <= 7;
    }).length;

    if (elements.deadline) {
      elements.deadline.textContent = closingSoon;
    }
  }

  // =========================================
  // FILTERING
  // =========================================

  function getFilteredOpportunities() {
    let result = [...opportunities];

    if (showingSaved) {
      result = result.filter(item => savedIds.has(item.id));
    }

    if (activeCategory !== "All") {
      result = result.filter(
        item => item.type === activeCategory
      );
    }

    const selectedType = elements.type?.value;

    if (selectedType) {
      result = result.filter(
        item => item.type === selectedType
      );
    }

    if (searchQuery) {
      result = result.filter(item => {
        const searchable = [
          item.title,
          item.organization,
          item.type,
          item.description,
          item.location,
          item.mode,
          item.eligibility,
          item.category
        ].join(" ").toLowerCase();

        return searchable.includes(searchQuery);
      });
    }

    const sort = elements.sort?.value || "newest";

    if (sort === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      );
    }

    if (sort === "deadline") {
      result.sort((a, b) => {
        const first = a.deadline
          ? new Date(a.deadline).getTime()
          : Infinity;

        const second = b.deadline
          ? new Date(b.deadline).getTime()
          : Infinity;

        return first - second;
      });
    }

    if (sort === "alphabetical") {
      result.sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    }

    return result;
  }

  // =========================================
  // CREATE OPPORTUNITY CARD
  // =========================================

  function createCard(item) {
    const card = createElement(
      "article",
      "opportunity-card"
    );

    const top = createElement("div", "card-topline");

    top.append(
      createElement(
        "span",
        "opportunity-type",
        item.type || "Opportunity"
      )
    );

    const saveButton = createElement(
      "button",
      `save-button ${savedIds.has(item.id) ? "saved" : ""}`,
      savedIds.has(item.id) ? "♥" : "♡"
    );

    saveButton.type = "button";
    saveButton.title = savedIds.has(item.id)
      ? "Remove bookmark"
      : "Save opportunity";

    saveButton.setAttribute(
      "aria-label",
      saveButton.title
    );

    saveButton.addEventListener("click", event => {
      event.stopPropagation();
      toggleSaved(item);
    });

    top.append(saveButton);

    card.append(top);

    card.append(
      createElement(
        "div",
        "organization-name",
        item.organization || "Organization not specified"
      ),
      createElement("h3", "", item.title),
      createElement(
        "p",
        "card-description",
        item.description || "No description available."
      )
    );

    const meta = createElement("div", "card-meta");

    meta.append(
      createElement(
        "span",
        "",
        `⌖ ${item.location || "Location not specified"}`
      ),
      createElement(
        "span",
        "",
        `◷ ${formatDate(item.deadline)}`
      )
    );

    const remaining = daysRemaining(item.deadline);

    if (remaining !== null && remaining >= 0 && remaining <= 7) {
      meta.append(
        createElement(
          "span",
          "deadline-warning",
          remaining === 0
            ? "Closes today"
            : `Closes in ${remaining} days`
        )
      );
    }

    card.append(meta);

    const footer = createElement("div", "card-footer");

    footer.append(
      createElement(
        "small",
        "",
        item.mode || "Details available"
      )
    );

    const viewButton = createElement(
      "button",
      "view-opportunity",
      "View details →"
    );

    viewButton.type = "button";

    viewButton.addEventListener("click", () => {
      openDetails(item);
    });

    footer.append(viewButton);
    card.append(footer);

    card.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      openDetails(item);
    });

    return card;
  }

  // =========================================
  // RENDER OPPORTUNITIES
  // =========================================

  function renderOpportunities() {
    if (!elements.grid) return;

    const filtered = getFilteredOpportunities();

    elements.grid.replaceChildren();

    if (elements.resultsTitle) {
      elements.resultsTitle.textContent = showingSaved
        ? "Your saved opportunities"
        : "Discover opportunities";
    }

    if (elements.resultsDescription) {
      elements.resultsDescription.textContent = showingSaved
        ? "Opportunities you've bookmarked."
        : "Explore what's available.";
    }

    if (elements.resultsCount) {
      elements.resultsCount.textContent =
        `${filtered.length} results`;
    }

    if (elements.empty) {
      elements.empty.hidden = filtered.length > 0;
    }

    filtered.forEach((item, index) => {
      const card = createCard(item);

      card.style.animationDelay = `${Math.min(index * 45, 300)}ms`;

      elements.grid.append(card);
    });

    updateStatistics();
  }

  // =========================================
  // SAVE / UNSAVE
  // =========================================

  async function toggleSaved(item) {
    const alreadySaved = savedIds.has(item.id);

    if (alreadySaved) {
      savedIds.delete(item.id);
    } else {
      savedIds.add(item.id);
    }

    setLocalSaved();
    updateStatistics();
    renderOpportunities();

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from(BOOKMARK_TABLE)
          .delete()
          .eq("user_id", currentUser.id)
          .eq("opportunity_id", item.id);

        if (error) throw error;

      } else {
        const { error } = await supabase
          .from(BOOKMARK_TABLE)
          .insert({
            user_id: currentUser.id,
            opportunity_id: item.id
          });

        if (error) throw error;
      }

    } catch (error) {
      console.error("Bookmark update:", error);

      // Restore the previous state if saving failed.
      if (alreadySaved) {
        savedIds.add(item.id);
      } else {
        savedIds.delete(item.id);
      }

      setLocalSaved();
      renderOpportunities();

      alert(
        "Your bookmark couldn't sync with your account. Please try again."
      );
    }
  }

  // =========================================
  // OPPORTUNITY DETAILS
  // =========================================

  function openDetails(item) {
    currentOpportunity = item;

    const content = elements.modalContent;

    if (!content) return;

    content.replaceChildren();

    content.append(
      createElement(
        "span",
        "opportunity-type",
        item.type || "Opportunity"
      ),
      createElement(
        "div",
        "organization-name",
        item.organization || "Organization not specified"
      ),
      createElement("h2", "", item.title),
      createElement(
        "p",
        "",
        item.description || "No description available."
      )
    );

    const metadata = createElement("div", "detail-meta");

    const fields = [
      ["Organization", item.organization],
      ["Location", item.location],
      ["Opportunity type", item.type],
      ["Format", item.mode],
      ["Deadline", formatDate(item.deadline)],
      [
        "Funding / reward",
        item.funding || "Not specified"
      ]
    ];

    fields.forEach(([label, value]) => {
      const wrapper = createElement("div");

      wrapper.append(
        createElement("span", "", label),
        createElement(
          "strong",
          "",
          value || "Not specified"
        )
      );

      metadata.append(wrapper);
    });

    content.append(metadata);

    if (item.eligibility) {
      content.append(
        createElement("h4", "", "Who can apply?"),
        createElement("p", "", item.eligibility)
      );
    }

    if (item.requirements) {
      content.append(
        createElement("h4", "", "Requirements"),
        createElement("p", "", item.requirements)
      );
    }

    if (item.source_url && isSafeUrl(item.source_url)) {
      const source = createElement(
        "a",
        "apply-button",
        "View official source ↗"
      );

      source.href = item.source_url;
      source.target = "_blank";
      source.rel = "noopener noreferrer";

      content.append(source);
    }

    const applyUrl = item.apply_url;

    if (applyUrl && isSafeUrl(applyUrl)) {
      const apply = createElement(
        "a",
        "apply-button",
        "Apply now ↗"
      );

      apply.href = applyUrl;
      apply.target = "_blank";
      apply.rel = "noopener noreferrer";

      content.append(apply);
    } else {
      content.append(
        createElement(
          "p",
          "",
          "An application link has not been provided. Visit the official source for details."
        )
      );
    }

    const save = createElement(
      "button",
      "saved-toggle",
      savedIds.has(item.id)
        ? "♥ Remove from saved"
        : "♡ Save opportunity"
    );

    save.type = "button";

    save.style.marginTop = "15px";

    save.addEventListener("click", () => {
      toggleSaved(item);
      openDetails(item);
    });

    content.append(save);

    elements.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function isSafeUrl(value) {
    try {
      const url = new URL(value);

      return (
        url.protocol === "https:" ||
        url.protocol === "http:"
      );
    } catch {
      return false;
    }
  }

  function closeDetails() {
    if (!elements.modal) return;

    elements.modal.hidden = true;
    document.body.style.overflow = "";

    currentOpportunity = null;
  }

  // =========================================
  // SEARCH
  // =========================================

  function handleSearch() {
    searchQuery = elements.search.value
      .trim()
      .toLowerCase();

    renderOpportunities();
  }

  // =========================================
  // CATEGORY FILTERS
  // =========================================

  function setupCategories() {
    if (!elements.categoryList) return;

    elements.categoryList.addEventListener(
      "click",
      event => {
        const button = event.target.closest(
          "[data-category]"
        );

        if (!button) return;

        activeCategory = button.dataset.category || "All";

        elements.categoryList
          .querySelectorAll("[data-category]")
          .forEach(item => {
            item.classList.toggle(
              "active",
              item === button
            );
          });

        renderOpportunities();
      }
    );
  }

  // =========================================
  // THEME
  // =========================================

  function applyTheme() {
    const savedTheme = localStorage.getItem("orbitTheme");

    const theme = savedTheme === "dark"
      ? "dark"
      : "light";

    document.documentElement.dataset.theme = theme;
  }

  function toggleTheme() {
    const current =
      document.documentElement.dataset.theme || "light";

    const next = current === "dark"
      ? "light"
      : "dark";

    document.documentElement.dataset.theme = next;

    localStorage.setItem("orbitTheme", next);
  }

  // =========================================
  // RESET FILTERS
  // =========================================

  function resetFilters() {
    activeCategory = "All";
    showingSaved = false;
    searchQuery = "";

    if (elements.search) {
      elements.search.value = "";
    }

    if (elements.type) {
      elements.type.value = "";
    }

    if (elements.sort) {
      elements.sort.value = "newest";
    }

    elements.categoryList
      ?.querySelectorAll("[data-category]")
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.category === "All"
        );
      });

    renderOpportunities();
  }

  // =========================================
  // EVENT LISTENERS
  // =========================================

  function setupEvents() {

    elements.search?.addEventListener(
      "input",
      handleSearch
    );

    elements.clearSearch?.addEventListener(
      "click",
      () => {
        elements.search.value = "";
        handleSearch();
        elements.search.focus();
      }
    );

    elements.type?.addEventListener(
      "change",
      renderOpportunities
    );

    elements.sort?.addEventListener(
      "change",
      renderOpportunities
    );

    elements.savedToggle?.addEventListener(
      "click",
      () => {
        showingSaved = !showingSaved;

        elements.savedToggle.classList.toggle(
          "active",
          showingSaved
        );

        renderOpportunities();
      }
    );

    elements.reset?.addEventListener(
      "click",
      resetFilters
    );

    elements.closeModal?.addEventListener(
      "click",
      closeDetails
    );

    elements.modal?.addEventListener(
      "click",
      event => {
        if (event.target === elements.modal) {
          closeDetails();
        }
      }
    );

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeDetails();
      }
    });

    elements.menu?.addEventListener(
      "click",
      () => {
        elements.sidebar?.classList.toggle("open");
      }
    );

    document.addEventListener("click", event => {
      if (
        window.innerWidth <= 900 &&
        elements.sidebar?.classList.contains("open") &&
        !elements.sidebar.contains(event.target) &&
        !elements.menu?.contains(event.target)
      ) {
        elements.sidebar.classList.remove("open");
      }
    });

    elements.theme?.addEventListener(
      "click",
      toggleTheme
    );

    elements.explore?.addEventListener(
      "click",
      () => {
        document
          .querySelector("#discovery")
          ?.scrollIntoView({
            behavior: "smooth"
          });
      }
    );

    setupCategories();
  }

  // =========================================
  // START ORBIT OPPORTUNITIES
  // =========================================

  initialise();

});