
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initialiseCommunity);

  const $ = (selector) => document.querySelector(selector);

  const postForm = $("#postForm");
  const postContent = $("#postContent");
  const postMessage = $("#postMessage");
  const publishButton = $("#publishPostButton");
  const postList = $("#postList");
  const feedStatus = $("#feedStatus");
  const emptyState = $("#emptyState");
  const emptyTitle = $("#emptyTitle");
  const emptyDescription = $("#emptyDescription");
  const searchInput = $("#searchPosts");
  const refreshButton = $("#refreshFeedButton");
  const characterCount = $("#characterCount");

  let currentUser = null;
  let studentProfile = null;
  let allPosts = [];
  let activeFilter = "all";

  function showMessage(message, type = "") {
    postMessage.textContent = message;
    postMessage.className = "form-message";

    if (type) {
      postMessage.classList.add(type);
    }
  }

  function setLoading(button, loading, normalText) {
    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
  }

  function getInitials(name) {
    return String(name || "ORBIT")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function setTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selectedTheme;
  }

  async function initialiseCommunity() {
    if (!window.orbitSupabase || !window.orbitAuth) {
      feedStatus.textContent =
        "ORBIT could not connect to its services. Please refresh the page.";
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        await window.orbitSupabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        window.location.href = "login.html";
        return;
      }

      currentUser = sessionData.session.user;

      await loadStudentProfile();
      await loadPosts();

      setupComposer();
      setupSearch();
      setupFilters();
      setupRefresh();
    } catch (error) {
      console.error("ORBIT Community initialisation:", error);

      feedStatus.textContent =
        "We couldn't load the community. Please refresh and try again.";
    }
  }

  async function loadStudentProfile() {
    const { data, error } = await window.orbitSupabase
      .from("student_profiles")
      .select(`
        display_name,
        full_name,
        university,
        theme,
        setup_completed
      `)
      .eq("user_id", currentUser.id)
      .single();

    if (error) throw error;

    if (!data || !data.setup_completed) {
      window.location.href = "setup.html";
      return;
    }

    studentProfile = data;

    setTheme(data.theme);

    const displayName =
      data.display_name ||
      data.full_name ||
      "ORBIT student";

    const institution =
      data.university ||
      "ORBIT student";

    $("#composerName").textContent = displayName;
    $("#composerInstitution").textContent = institution;
    $("#composerAvatar").textContent = getInitials(displayName);
  }

  async function loadPosts() {
    feedStatus.hidden = false;
    feedStatus.textContent = "Loading conversations...";

    postList.replaceChildren();
    emptyState.hidden = true;

    const { data, error } = await window.orbitSupabase
      .from("community_posts")
      .select(`
        id,
        user_id,
        author_display_name,
        author_institution,
        content,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    allPosts = data || [];

    feedStatus.hidden = true;

    renderPosts();
  }

  function setupComposer() {
    postContent.addEventListener("input", () => {
      characterCount.textContent =
        `${postContent.value.length} / 2000`;
    });

    postForm.addEventListener("submit", publishPost);
  }

  async function publishPost(event) {
    event.preventDefault();

    const content = postContent.value.trim();

    if (!content) {
      showMessage("Write something before publishing.", "error");
      return;
    }

    if (content.length > 2000) {
      showMessage("Your post is too long.", "error");
      return;
    }

    if (!currentUser || !studentProfile) {
      showMessage("Your student profile is not ready.", "error");
      return;
    }

    setLoading(publishButton, true, "Publish post ↗");
    showMessage();

    try {
      const { error } = await window.orbitSupabase
        .from("community_posts")
        .insert({
          user_id: currentUser.id,
          content
        });

      if (error) throw error;

      postContent.value = "";
      characterCount.textContent = "0 / 2000";

      showMessage("Your post has been published!", "success");

      await loadPosts();
    } catch (error) {
      console.error("ORBIT post publishing:", error);

      showMessage(
        "Your post couldn't be published. Please try again.",
        "error"
      );
    } finally {
      setLoading(publishButton, false, "Publish post ↗");
    }
  }

  function setupSearch() {
    searchInput.addEventListener("input", renderPosts);
  }

  function setupFilters() {
    document.querySelectorAll("[data-feed-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.feedFilter;

        document.querySelectorAll("[data-feed-filter]").forEach((tab) => {
          tab.classList.toggle("active", tab === button);
        });

        renderPosts();
      });
    });
  }

  function setupRefresh() {
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;

      try {
        await loadPosts();
      } catch (error) {
        console.error("ORBIT feed refresh:", error);
        feedStatus.hidden = false;
        feedStatus.textContent =
          "Couldn't refresh the feed. Please try again.";
      } finally {
        refreshButton.disabled = false;
      }
    });
  }

  function renderPosts() {
    postList.replaceChildren();

    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredPosts = allPosts.filter((post) => {
      const matchesFilter =
        activeFilter === "all" ||
        post.user_id === currentUser.id;

      const searchableText = [
        post.content,
        post.author_display_name,
        post.author_institution
      ].join(" ").toLowerCase();

      return matchesFilter && searchableText.includes(searchTerm);
    });

    if (filteredPosts.length === 0) {
      emptyState.hidden = false;

      if (searchTerm) {
        emptyTitle.textContent = "No matches found.";
        emptyDescription.textContent =
          "Try another search term.";
      } else if (activeFilter === "mine") {
        emptyTitle.textContent = "Your posts will appear here.";
        emptyDescription.textContent =
          "Share your first thought with the ORBIT community.";
      } else {
        emptyTitle.textContent = "It's quiet here.";
        emptyDescription.textContent =
          "Start a conversation and give the community something to talk about.";
      }

      return;
    }

    emptyState.hidden = true;

    filteredPosts.forEach((post) => {
      postList.appendChild(createPostCard(post));
    });
  }

  function createPostCard(post) {
    const card = document.createElement("article");
    card.className = "post-card";

    const header = document.createElement("div");
    header.className = "post-header";

    const avatar = document.createElement("div");
    avatar.className = "post-avatar";
    avatar.textContent = getInitials(post.author_display_name);

    const authorDetails = document.createElement("div");
    authorDetails.className = "post-author-details";

    const authorName = document.createElement("strong");
    authorName.textContent = post.author_display_name;

    const institution = document.createElement("span");
    institution.textContent = post.author_institution;

    const date = document.createElement("time");
    date.className = "post-date";
    date.dateTime = post.created_at;
    date.textContent = formatDate(post.created_at);

    authorDetails.append(authorName, institution);
    header.append(avatar, authorDetails, date);

    const content = document.createElement("p");
    content.className = "post-content";
    content.textContent = post.content;

    card.append(header, content);

    if (post.user_id === currentUser.id) {
      const actions = document.createElement("div");
      actions.className = "post-actions";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-post-button";
      deleteButton.textContent = "Delete post";

      deleteButton.addEventListener("click", () => {
        deletePost(post.id, deleteButton);
      });

      actions.appendChild(deleteButton);
      card.appendChild(actions);
    }

    return card;
  }

  async function deletePost(postId, button) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this post?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
      const { error } = await window.orbitSupabase
        .from("community_posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      allPosts = allPosts.filter((post) => post.id !== postId);

      renderPosts();
    } catch (error) {
      console.error("ORBIT post deletion:", error);

      button.disabled = false;
      button.textContent = "Delete post";

      window.alert("We couldn't delete that post. Please try again.");
    }
  }
})();
