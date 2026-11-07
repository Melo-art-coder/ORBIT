/* =========================================
   ORBIT DISCOVER
   Opportunity discovery and bookmarks
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const supabase = window.orbitSupabase;

  const TABLE = "opportunities";
  const BOOKMARKS = "opportunity_bookmarks";

  const $ = id => document.getElementById(id);

  const elements = {
    grid: $("opportunityGrid"),
    empty: $("emptyState"),

    total: $("totalCount"),
    saved: $("savedCount"),
    deadline: $("deadlineCount"),
    badge: $("savedBadge"),

    search: $("searchInput"),
    type: $("typeFilter"),
    location: $("locationFilter"),
    sort: $("sortFilter"),

    resultsCount: $("resultsCount"),
    resultsTitle: $("resultsTitle"),
    resultsDescription: $("resultsDescription"),

    modal: $("detailModal"),
    modalContent: $("modalContent")
  };

  let currentUser = null;
  let opportunities = [];
  let savedIds = new Set();

  let activeCategory = "";
  let showingSaved = false;

  // =====================================
  // HELPERS
  // =====================================

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
    );
  }

  function daysRemaining(date) {
    if (!date) return null;

    const deadline = new Date(date + "T23:59:59");
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return Math.ceil(
      (deadline - today) / 86400000
    );
  }

  function formatDate(date) {
    if (!date) return "Not specified";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "Not specified";
    }

    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function normalise(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validOpportunity(item) {
    const status = normalise(item.status);

    const allowed = [
      "",
      "active",
      "published",
      "open"
    ];

    if (!allowed.includes(status)) {
      return false;
    }

    const remaining = daysRemaining(item.deadline);

    return remaining === null || remaining >= 0;
  }

  function showMessage(message) {
    elements.grid.innerHTML = `
      <div class="loading-state">
        <p>${escapeHTML(message)}</p>
      </div>
    `;
  }


  // =====================================
  // AUTHENTICATION
  // =====================================

  async function initialiseUser() {
    if (!supabase) {
      throw new Error(
        "ORBIT authentication could not be loaded."
      );
    }

    const {
      data,
      error
    } = await supabase.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    if (!currentUser) {
      window.location.href = "index.html";
      return false;
    }

    const avatar = $("userAvatar");

    if (avatar) {
      avatar.textContent = (
        currentUser.user_metadata?.display_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.email ||
        "O"
      ).charAt(0).toUpperCase();
    }

    return true;
  }


  // =====================================
  // LOAD OPPORTUNITIES
  // =====================================

  async function loadOpportunities() {
    showMessage("Finding opportunities...");

    const {
      data,
      error
    } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error("Discover loading error:", error);

      showMessage(
        "Unable to load opportunities. Please refresh."
      );

      return;
    }

    opportunities = (data || []).filter(
      validOpportunity
    );

    await loadBookmarks();

    updateStatistics();
    renderOpportunities();
  }


  // =====================================
  // LOAD BOOKMARKS
  // =====================================

  async function loadBookmarks() {
    const {
      data,
      error
    } = await supabase
      .from(BOOKMARKS)
      .select("opportunity_id")
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Bookmark loading error:", error);
      savedIds = new Set();
      return;
    }

    savedIds = new Set(
      (data || []).map(item => item.opportunity_id)
    );
  }


  // =====================================
  // STATISTICS
  // =====================================

  function updateStatistics() {
    const closingSoon = opportunities.filter(item => {
      const days = daysRemaining(item.deadline);

      return days !== null && days >= 0 && days <= 7;
    }).length;

    elements.total.textContent = opportunities.length;
    elements.saved.textContent = savedIds.size;
    elements.badge.textContent = savedIds.size;
    elements.deadline.textContent = closingSoon;
  }


  // =====================================
  // FILTERING
  // =====================================

  function getFilteredOpportunities() {
    let results = [...opportunities];

    const search = normalise(
      elements.search.value
    );

    const type = elements.type.value;
    const location = normalise(elements.location.value);
    const sort = elements.sort.value;

    if (showingSaved) {
      results = results.filter(
        item => savedIds.has(item.id)
      );
    }

    if (activeCategory) {
      results = results.filter(
        item => normalise(item.type) === normalise(activeCategory)
      );
    }

    if (type) {
      results = results.filter(
        item => normalise(item.type) === normalise(type)
      );
    }

    if (location) {
      results = results.filter(item => {
        const text = normalise(item.location);

        return text.includes(location) ||
          (location === "remote" &&
           normalise(item.mode).includes("remote"));
      });
    }

    if (search) {
      results = results.filter(item => {
        const searchable = [
          item.title,
          item.organization,
          item.type,
          item.description,
          item.location,
          item.mode,
          item.eligibility,
          item.funding
        ].join(" ").toLowerCase();

        return searchable.includes(search);
      });
    }

    if (sort === "deadline") {
      results.sort((a, b) => {
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
      results.sort((a, b) =>
        String(a.title || "").localeCompare(
          String(b.title || "")
        )
      );
    }

    if (sort === "newest") {
      results.sort((a, b) =>
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
      );
    }

    return results;
  }


  // =====================================
  // RENDER CARDS
  // =====================================

  function renderOpportunities() {
    const results = getFilteredOpportunities();

    elements.grid.innerHTML = "";

    elements.resultsCount.textContent =
      `${results.length} results`;

    elements.resultsTitle.textContent =
      showingSaved
        ? "Your saved opportunities"
        : "Explore opportunities";

    elements.resultsDescription.textContent =
      showingSaved
        ? "Opportunities you've bookmarked."
        : "Discover something worth applying for.";

    elements.empty.hidden = results.length !== 0;

    if (!results.length) return;

    results.forEach(item => {
      elements.grid.appendChild(
        createOpportunityCard(item)
      );
    });
  }


  function createOpportunityCard(item) {
    const card = document.createElement("article");

    card.className = "opportunity-card";

    const saved = savedIds.has(item.id);
    const remaining = daysRemaining(item.deadline);

    const deadlineLabel =
      remaining === null
        ? "Deadline not specified"
        : remaining === 0
          ? "Closes today"
          : remaining === 1
            ? "1 day left"
            : `${remaining} days left`;

    const deadlineClass =
      remaining !== null && remaining <= 7
        ? "deadline-warning"
        : "";

    card.innerHTML = `
      <div class="card-top">

        <span class="type-label">
          ${escapeHTML(item.type || "Opportunity")}
        </span>

        <button
          class="bookmark-button ${saved ? "saved" : ""}"
          aria-label="Save opportunity"
          data-bookmark="${escapeHTML(item.id)}"
        >
          ${saved ? "♥" : "♡"}
        </button>

      </div>

      <h3>${escapeHTML(item.title)}</h3>

      <div class="organization">
        ${escapeHTML(item.organization || "Organization not specified")}
      </div>

      <p class="card-description">
        ${escapeHTML(
          String(item.description || "No description provided.")
            .slice(0, 175)
        )}${String(item.description || "").length > 175 ? "..." : ""}
      </p>

      <div class="card-meta">

        <span class="meta-pill">
          ◉ ${escapeHTML(item.location || "Location not specified")}
        </span>

        <span class="meta-pill">
          ◷ ${escapeHTML(item.mode || "Mode not specified")}
        </span>

        <span class="meta-pill ${deadlineClass}">
          ${escapeHTML(deadlineLabel)}
        </span>

      </div>

      <div class="card-footer">

        <span class="card-source">
          ${item.source_url ? "External source available" : "ORBIT listing"}
        </span>

        <button
          class="view-button"
          data-view="${escapeHTML(item.id)}"
        >
          View details ↗
        </button>

      </div>
    `;

    return card;
  }


  // =====================================
  // OPPORTUNITY DETAILS
  // =====================================

  function openDetails(id) {
    const item = opportunities.find(
      opportunity => opportunity.id === id
    );

    if (!item) return;

    elements.modalContent.innerHTML = `
      <div class="modal-content">

        <span class="type-label">
          ${escapeHTML(item.type || "Opportunity")}
        </span>

        <h2>${escapeHTML(item.title)}</h2>

        <p>
          ${escapeHTML(item.organization || "Organization not specified")}
        </p>

        <h4>Description</h4>
        <p>${escapeHTML(item.description || "No description provided.")}</p>

        <h4>Location</h4>
        <p>${escapeHTML(item.location || "Not specified")}</p>

        <h4>Mode</h4>
        <p>${escapeHTML(item.mode || "Not specified")}</p>

        <h4>Funding</h4>
        <p>${escapeHTML(item.funding || "Not specified")}</p>

        <h4>Eligibility</h4>
        <p>${escapeHTML(item.eligibility || "Not specified")}</p>

        <h4>Requirements</h4>
        <p>${escapeHTML(item.requirements || "Not specified")}</p>

        <h4>Application deadline</h4>
        <p>${escapeHTML(formatDate(item.deadline))}</p>

        ${
          item.source_url
            ? `<p>
                <a href="${safeExternalURL(item.source_url)}"
                   target="_blank"
                   rel="noopener noreferrer">
                  View original source ↗
                </a>
              </p>`
            : ""
        }

        ${
          item.apply_url
            ? `<a
                class="modal-apply"
                href="${safeExternalURL(item.apply_url)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apply now ↗
              </a>`
            : `<p>Application link not available.</p>`
        }

      </div>
    `;

    elements.modal.hidden = false;
  }


  function safeExternalURL(value) {
    try {
      const url = new URL(value);

      if (!["https:", "http:"].includes(url.protocol)) {
        return "#";
      }

      return escapeHTML(url.href);
    } catch {
      return "#";
    }
  }


  // =====================================
  // BOOKMARKS
  // =====================================

  async function toggleBookmark(id) {
    if (!currentUser) return;

    const alreadySaved = savedIds.has(id);

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from(BOOKMARKS)
          .delete()
          .eq("user_id", currentUser.id)
          .eq("opportunity_id", id);

        if (error) throw error;

        savedIds.delete(id);

      } else {
        const { error } = await supabase
          .from(BOOKMARKS)
          .insert({
            user_id: currentUser.id,
            opportunity_id: id
          });

        if (error) throw error;

        savedIds.add(id);
      }

      updateStatistics();
      renderOpportunities();

    } catch (error) {
      console.error("Bookmark error:", error);

      alert(
        "Unable to update your saved opportunities. Please try again."
      );
    }
  }


  // =====================================
  // EVENTS
  // =====================================

  elements.search.addEventListener(
    "input",
    renderOpportunities
  );

  elements.type.addEventListener(
    "change",
    () => {
      activeCategory = "";
      updateCategoryButtons();
      renderOpportunities();
    }
  );

  elements.location.addEventListener(
    "change",
    renderOpportunities
  );

  elements.sort.addEventListener(
    "change",
    renderOpportunities
  );

  $("clearSearch").addEventListener("click", () => {
    elements.search.value = "";
    renderOpportunities();
  });

  $("categoryList").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");

    if (!button) return;

    activeCategory = button.dataset.category;

    elements.type.value = "";

    updateCategoryButtons();
    renderOpportunities();
  });


  function updateCategoryButtons() {
    document.querySelectorAll(".category-chip").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.category === activeCategory
      );
    });
  }


  elements.grid.addEventListener("click", event => {
    const bookmark = event.target.closest("[data-bookmark]");

    if (bookmark) {
      toggleBookmark(bookmark.dataset.bookmark);
      return;
    }

    const view = event.target.closest("[data-view]");

    if (view) {
      openDetails(view.dataset.view);
    }
  });


  $("savedToggle").addEventListener("click", () => {
    showingSaved = !showingSaved;

    $("savedToggle").classList.toggle(
      "active",
      showingSaved
    );

    renderOpportunities();
  });


  $("resetFilters").addEventListener("click", () => {
    elements.search.value = "";
    elements.type.value = "";
    elements.location.value = "";
    elements.sort.value = "newest";

    activeCategory = "";
    showingSaved = false;

    updateCategoryButtons();
    renderOpportunities();
  });


  $("exploreButton").addEventListener("click", () => {
    $("discoverSection").scrollIntoView({
      behavior: "smooth"
    });
  });


  $("closeModal").addEventListener("click", () => {
    elements.modal.hidden = true;
  });

  elements.modal.addEventListener("click", event => {
    if (event.target === elements.modal) {
      elements.modal.hidden = true;
    }
  });


  $("menuButton").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });


  $("themeButton").addEventListener("click", () => {
    document.body.classList.toggle("dark");

    localStorage.setItem(
      "orbitDiscoverTheme",
      document.body.classList.contains("dark")
        ? "dark"
        : "light"
    );
  });


  // =====================================
  // INITIALISE
  // =====================================

  async function initialise() {
    try {
      const savedTheme = localStorage.getItem(
        "orbitDiscoverTheme"
      );

      if (savedTheme === "dark") {
        document.body.classList.add("dark");
      }

      const authenticated = await initialiseUser();

      if (!authenticated) return;

      await loadOpportunities();

    } catch (error) {
      console.error("ORBIT Discover:", error);

      showMessage(
        error.message || "Something went wrong."
      );
    }
  }

  initialise();

});