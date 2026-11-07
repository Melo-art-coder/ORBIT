
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ==========================================
  // ORBIT MARKETPLACE
  // ==========================================

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const supabase = window.orbitSupabase;
  const BUCKET = "orbit-marketplace";
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

  let currentUser = null;
  let studentProfile = null;
  let products = [];
  let likes = {};
  let commentCounts = {};

  let selectedCategory = "All";
  let selectedFeed = "all";
  let selectedProduct = null;
  let selectedConversation = null;
  let conversations = [];
  let replyingTo = null;
  let editingProductId = null;
  let selectedImageFile = null;
  let activeMessageChannel = null;

  const el = {
    avatar: $("#marketUserAvatar"),
    search: $("#searchProducts"),
    clearSearch: $("#clearSearchButton"),
    filterToggle: $("#filterToggleButton"),
    filterPanel: $("#marketFilterPanel"),
    institution: $("#institutionFilter"),
    sort: $("#sortProducts"),
    grid: $("#productGrid"),
    status: $("#productStatus"),
    empty: $("#marketEmpty"),

    listing: $("#listingSection"),
    listingForm: $("#listingForm"),
    title: $("#productTitle"),
    category: $("#productCategory"),
    price: $("#productPrice"),
    description: $("#productDescription"),
    location: $("#productLocation"),
    imageInput: $("#productImage"),
    imageArea: $(".image-upload-area"),
    imagePreview: $("#imagePreview"),
    removeImage: $("#removeImageButton"),
    listingMessage: $("#listingMessage"),
    publish: $("#publishListingButton"),

    detail: $("#productDetailSection"),
    detailContent: $("#productDetailContent"),
    commentForm: $("#commentForm"),
    commentInput: $("#commentInput"),
    commentList: $("#commentList"),
    commentStatus: $("#commentStatus"),

    messages: $("#marketMessagesSection"),
    conversationList: $("#conversationList"),
    conversationHeader: $("#conversationHeader"),
    messageList: $("#messageList"),
    messageForm: $("#messageForm"),
    messageInput: $("#messageInput"),

    shop: $("#marketShopSection"),
    shopName: $("#shopDisplayName"),
    shopInstitution: $("#shopInstitution"),
    shopAvatar: $("#shopAvatar"),
    shopGrid: $("#shopProductGrid"),

    sellerDashboard: $("#sellerDashboard"),
    sellerProductCount: $("#sellerProductCount"),
    sellerLikeCount: $("#sellerLikeCount"),
    sellerCommentCount: $("#sellerCommentCount")
  };

  // ==========================================
  // HELPERS
  // ==========================================

  function make(tag, className = "", text = "") {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== "") node.textContent = text;

    return node;
  }

  function clear(node) {
    if (node) node.replaceChildren();
  }

  function message(node, text, type = "error") {
    if (!node) return;

    node.textContent = text;
    node.className = `form-message show ${type}`;
  }

  function clearMessage(node) {
    if (!node) return;

    node.textContent = "";
    node.className = "form-message";
  }

  function initials(name = "Student") {
    return name.trim().split(/\s+/)
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase() || "")
      .join("");
  }

  function displayName() {
    return studentProfile?.display_name ||
      studentProfile?.full_name ||
      "ORBIT Student";
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "Recently";
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium"
    }).format(date);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function scrollTo(node) {
    node?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function setTheme(theme) {
    const value = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    localStorage.setItem("orbitTheme", value);
  }

  function publicImage(path) {
    if (!path) return "";

    return supabase.storage
      .from(BUCKET)
      .getPublicUrl(path).data.publicUrl;
  }

  function setStatus(text, type = "") {
    if (!el.status) return;

    el.status.textContent = text;
    el.status.className = `product-status ${type}`.trim();
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  async function initialise() {
    if (!supabase) {
      setStatus("Authentication service unavailable.", "error");
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      currentUser = data.session?.user;

      if (!currentUser) {
        location.href = "login.html";
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("student_profiles")
          .select(`
            display_name,
            full_name,
            university,
            theme,
            setup_completed
          `)
          .eq("user_id", currentUser.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !profile.setup_completed) {
        location.href = "setup.html";
        return;
      }

      studentProfile = profile;
      setTheme(profile.theme);

      if (el.avatar) {
        el.avatar.textContent = initials(displayName());
      }

      await loadProducts();
      setupEvents();

    } catch (error) {
      console.error("ORBIT Marketplace:", error);
      setStatus("Couldn't open the marketplace. Please refresh.", "error");
    }
  }

  // ==========================================
  // PRODUCTS
  // ==========================================

  async function loadProducts() {
    setStatus("Loading marketplace...");

    try {
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      products = data || [];
      await enrichSellerProfiles();

      await loadEngagement();
      await loadInstitutions();
      renderProducts();
      await loadSellerStats();

      setStatus(`${products.length} products available.`);

    } catch (error) {
      console.error("Product loading:", error);
      setStatus(error.message || "Couldn't load products. Please try again.", "error");
    }
  }

  async function enrichSellerProfiles() {
    const sellerIds = [...new Set(
      products.map(product => product.seller_id).filter(Boolean)
    )];

    if (!sellerIds.length) return;

    const { data, error } = await supabase
      .from("student_profiles")
      .select("user_id,display_name,full_name,university")
      .in("user_id", sellerIds);

    if (error) {
      console.warn("Seller profile details could not be loaded:", error);
      products = products.map(product => ({
        ...product,
        seller_display_name: product.seller_display_name || "ORBIT student",
        seller_institution: product.seller_institution || "ORBIT marketplace"
      }));
      return;
    }

    const profiles = new Map(
      (data || []).map(profile => [profile.user_id, profile])
    );

    products = products.map(product => {
      const profile = profiles.get(product.seller_id);
      return {
        ...product,
        seller_display_name:
          product.seller_display_name ||
          profile?.display_name ||
          profile?.full_name ||
          "ORBIT student",
        seller_institution:
          product.seller_institution ||
          profile?.university ||
          "ORBIT marketplace"
      };
    });
  }

  async function loadEngagement() {
    likes = {};
    commentCounts = {};

    const ids = products.map(product => product.id);
    if (!ids.length) return;

    const [likeResult, commentResult] = await Promise.all([
      supabase
        .from("marketplace_likes")
        .select("product_id,user_id")
        .in("product_id", ids),

      supabase
        .from("marketplace_comments")
        .select("product_id")
        .in("product_id", ids)
    ]);

    if (likeResult.error) throw likeResult.error;
    if (commentResult.error) throw commentResult.error;

    (likeResult.data || []).forEach(item => {
      likes[item.product_id] ??= {
        count: 0,
        liked: false
      };

      likes[item.product_id].count++;

      if (item.user_id === currentUser.id) {
        likes[item.product_id].liked = true;
      }
    });

    (commentResult.data || []).forEach(item => {
      commentCounts[item.product_id] =
        (commentCounts[item.product_id] || 0) + 1;
    });
  }

  // ==========================================
  // PRODUCT CARDS
  // ==========================================

  function createProductCard(product) {
    const card = make("article", "product-card");
    const imageWrap = make("div", "product-image-wrap");

    if (product.image_path) {
      const image = make("img", "product-image");
      image.src = publicImage(product.image_path);
      image.alt = product.title;
      image.loading = "lazy";

      image.onerror = () => {
        image.replaceWith(
          make("div", "product-image-placeholder", "✳")
        );
      };

      imageWrap.append(image);
    } else {
      imageWrap.append(
        make("div", "product-image-placeholder", "✳")
      );
    }

    imageWrap.append(
      make("span", "product-category", product.category)
    );

    const details = make("div", "product-details");

    details.append(
      make("h3", "product-title", product.title),
      make("strong", "product-price", formatMoney(product.price)),
      make(
        "p",
        "product-description",
        (product.description || "No description provided.").length > 95
          ? (product.description || "No description provided.").slice(0, 95) + "..."
          : (product.description || "No description provided.")
      ),
      make("span", "product-location", `⌖ ${product.location || "Location not specified"}`)
    );

    const seller = make(
      "button",
      "product-seller",
      `Sold by ${product.seller_display_name || "ORBIT student"}`
    );

    seller.type = "button";
    seller.addEventListener("click", () => openShop(product.seller_id));

    details.append(seller);

    const actions = make("div", "product-card-actions");

    const engagement = likes[product.id] || {
      count: 0,
      liked: false
    };

    const likeButton = make(
      "button",
      `like-button ${engagement.liked ? "liked" : ""}`,
      `${engagement.liked ? "♥" : "♡"} ${engagement.count}`
    );

    likeButton.type = "button";
    likeButton.addEventListener("click", () => toggleLike(product));

    const commentsButton = make(
      "button",
      "",
      `Comments ${commentCounts[product.id] || 0}`
    );

    commentsButton.type = "button";
    commentsButton.addEventListener("click", () => openProduct(product));

    const viewButton = make("button", "", "View item →");
    viewButton.type = "button";
    viewButton.addEventListener("click", () => openProduct(product));

    actions.append(likeButton, commentsButton, viewButton);
    details.append(actions);
    card.append(imageWrap, details);

    return card;
  }

  // ==========================================
  // SEARCH AND FILTERING
  // ==========================================

  function filteredProducts() {
    let result = [...products];

    const query = el.search?.value.trim().toLowerCase() || "";

    if (query) {
      result = result.filter(product => {
        const searchable = [
          product.title,
          product.description,
          product.category,
          product.location,
          product.seller_display_name,
          product.seller_institution
        ].join(" ").toLowerCase();

        return searchable.includes(query);
      });
    }

    if (selectedCategory !== "All") {
      result = result.filter(
        product => product.category === selectedCategory
      );
    }

    if (el.institution?.value) {
      result = result.filter(
        product =>
          product.seller_institution === el.institution.value
      );
    }

    if (selectedFeed === "mine") {
      result = result.filter(
        product => product.seller_id === currentUser.id
      );
    }

    if (selectedFeed === "trending") {
      result.sort(
        (a, b) =>
          (likes[b.id]?.count || 0) -
          (likes[a.id]?.count || 0)
      );
    }

    const sort = el.sort?.value || "newest";

    if (sort === "newest") {
      result.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    } else if (sort === "oldest") {
      result.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    } else if (sort === "price-low") {
      result.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === "price-high") {
      result.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return result;
  }

  function renderProducts() {
    if (!el.grid) return;

    clear(el.grid);

    const result = filteredProducts();

    if (el.empty) el.empty.hidden = result.length > 0;

    result.forEach(product => {
      el.grid.append(createProductCard(product));
    });
  }

  async function loadInstitutions() {
    if (!el.institution) return;

    const previous = el.institution.value;

    const institutions = [
      ...new Set(
        products
          .map(product => product.seller_institution)
          .filter(Boolean)
      )
    ].sort();

    clear(el.institution);

    const all = make("option", "", "All institutions");
    all.value = "";
    el.institution.append(all);

    institutions.forEach(name => {
      const option = make("option", "", name);
      option.value = name;
      el.institution.append(option);
    });

    el.institution.value = previous;
  }

  // ==========================================
  // LIKES
  // ==========================================

  async function toggleLike(product) {
    const current = likes[product.id] || {
      count: 0,
      liked: false
    };

    try {
      let result;

      if (current.liked) {
        result = await supabase
          .from("marketplace_likes")
          .delete()
          .eq("product_id", product.id)
          .eq("user_id", currentUser.id);
      } else {
        result = await supabase
          .from("marketplace_likes")
          .insert({
            product_id: product.id,
            user_id: currentUser.id
          });
      }

      if (result.error) throw result.error;

      await loadEngagement();
      renderProducts();
      await loadSellerStats();

      if (selectedProduct?.id === product.id) {
        renderProductDetails(product);
      }

    } catch (error) {
      console.error("Like action:", error);
      alert("Couldn't update your like. Please try again.");
    }
  }

  // ==========================================
  // LISTING FORM
  // ==========================================

  function openListing(product = null) {
    if (!el.listing) return;

    editingProductId = product?.id || null;
    selectedImageFile = null;

    el.listing.hidden = false;
    el.listingForm?.reset();

    clearMessage(el.listingMessage);
    clear(el.imagePreview);
    if (el.imagePreview) el.imagePreview.hidden = true;
    el.imageArea?.classList.remove("has-image");

    if (product) {
      el.title.value = product.title;
      el.category.value = product.category;
      el.price.value = product.price;
      el.description.value = product.description;
      el.location.value = product.location;

      if (el.publish) el.publish.textContent = "Save changes";

      if (product.image_path) {
        const image = make("img");
        image.src = publicImage(product.image_path);
        image.alt = "Current product image";
        el.imagePreview?.append(image);
        if (el.imagePreview) el.imagePreview.hidden = false;
        el.imageArea?.classList.add("has-image");
      }
    } else {
      if (el.publish) el.publish.textContent = "Publish listing";
    }

    scrollTo(el.listing);
  }

  function closeListing() {
    if (!el.listing) return;

    el.listing.hidden = true;
    editingProductId = null;
    selectedImageFile = null;

    el.listingForm?.reset();
    clear(el.imagePreview);
    if (el.imagePreview) el.imagePreview.hidden = true;
    el.imageArea?.classList.remove("has-image");
    clearMessage(el.listingMessage);
  }

  function handleImage(file) {
    selectedImageFile = file || null;
    clear(el.imagePreview);
    if (el.imagePreview) el.imagePreview.hidden = true;
    el.imageArea?.classList.remove("has-image");

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      message(el.listingMessage, "Use a JPG, PNG or WebP image.");
      selectedImageFile = null;
      el.imageInput.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      message(el.listingMessage, "Images must be smaller than 3MB.");
      selectedImageFile = null;
      el.imageInput.value = "";
      return;
    }

    const image = make("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Selected product image";
    el.imagePreview?.append(image);
    if (el.imagePreview) el.imagePreview.hidden = false;
    el.imageArea?.classList.add("has-image");
    clearMessage(el.listingMessage);
  }

  async function uploadImage(file) {
    if (!file) return null;

    const extension = file.type === "image/jpeg"
      ? "jpg"
      : file.type.split("/")[1];

    const path =
      `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;

    return path;
  }

  async function removeImage(path) {
    if (!path || !path.startsWith(`${currentUser.id}/`)) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) console.error("Image cleanup:", error);
  }

  async function publishProduct(event) {
    event.preventDefault();
    clearMessage(el.listingMessage);

    const title = el.title.value.trim();
    const category = el.category.value;
    const price = Number(el.price.value);
    const description = el.description.value.trim();
    const location = el.location.value.trim();

    const categories = [
      "Food", "Fashion", "Electronics",
      "Books", "Beauty", "Services", "Other"
    ];

    if (!title || title.length > 90) {
      message(el.listingMessage, "Enter a title under 90 characters.");
      return;
    }

    if (!categories.includes(category)) {
      message(el.listingMessage, "Choose a valid category.");
      return;
    }

    if (!Number.isFinite(price) || price < 0 || price > 100000000) {
      message(el.listingMessage, "Enter a valid price.");
      return;
    }

    if (!description || description.length > 1000) {
      message(el.listingMessage, "Description must be 1–1000 characters.");
      return;
    }

    if (!location || location.length > 120) {
      message(el.listingMessage, "Enter a general area or campus location.");
      return;
    }

    const buttonText = editingProductId
      ? "Save changes"
      : "Publish listing";

    if (el.publish) {
      el.publish.disabled = true;
      el.publish.textContent = "Publishing...";
    }

    let uploadedPath = null;

    try {
      const previousProduct = editingProductId
        ? products.find(item => item.id === editingProductId)
        : null;

      if (selectedImageFile) {
        uploadedPath = await uploadImage(selectedImageFile);
      }

      const payload = {
        title,
        category,
        price,
        description,
        location
      };

      if (uploadedPath) payload.image_path = uploadedPath;

      let savedProductId = editingProductId;

      if (editingProductId) {
        const { error } = await supabase
          .from("marketplace_products")
          .update(payload)
          .eq("id", editingProductId)
          .eq("seller_id", currentUser.id);

        if (error) throw error;

        if (uploadedPath && previousProduct?.image_path) {
          await removeImage(previousProduct.image_path);
        }

      } else {
        const { data: insertedProduct, error } = await supabase
          .from("marketplace_products")
          .insert({
            ...payload,
            seller_id: currentUser.id
          })
          .select("id")
          .single();

        if (error) throw error;
        savedProductId = insertedProduct.id;
      }

      await loadProducts();
      showListingSuccess(savedProductId, Boolean(editingProductId));

    } catch (error) {
      console.error("Publishing product:", error);

      if (uploadedPath) await removeImage(uploadedPath);

      message(
        el.listingMessage,
        error.message || "Couldn't publish your listing."
      );

    } finally {
      if (el.publish) {
        el.publish.disabled = false;
        el.publish.textContent = buttonText;
      }
    }
  }

  function showListingSuccess(productId, wasEditing) {
    if (!el.listingMessage) return;

    message(
      el.listingMessage,
      wasEditing ? "Your listing has been updated." : "Your listing is live on ORBIT!",
      "success"
    );

    const actions = make("div", "listing-success-actions");
    const continueButton = make("button", "secondary-button", "Continue posting");
    continueButton.type = "button";
    continueButton.addEventListener("click", () => {
      editingProductId = null;
      selectedImageFile = null;
      el.listingForm?.reset();
      clear(el.imagePreview);
      if (el.imagePreview) el.imagePreview.hidden = true;
      el.imageArea?.classList.remove("has-image");
      if (el.publish) el.publish.textContent = "Publish listing";
      clearMessage(el.listingMessage);
      el.title?.focus();
      scrollTo(el.listing);
    });

    const editButton = make("button", "primary-button", "Edit this listing");
    editButton.type = "button";
    editButton.addEventListener("click", () => {
      editingProductId = productId;
      if (el.publish) el.publish.textContent = "Save changes";
      clearMessage(el.listingMessage);
      el.title?.focus();
      scrollTo(el.listing);
    });

    actions.append(continueButton, editButton);
    el.listingMessage.append(actions);
  }

  async function deleteProduct(product) {
    if (product.seller_id !== currentUser.id) return;

    if (!confirm(`Delete "${product.title}"?`)) return;

    try {
      const { error } = await supabase
        .from("marketplace_products")
        .delete()
        .eq("id", product.id)
        .eq("seller_id", currentUser.id);

      if (error) throw error;

      await removeImage(product.image_path);

      selectedProduct = null;
      if (el.detail) el.detail.hidden = true;

      await loadProducts();

    } catch (error) {
      console.error("Delete product:", error);
      alert("Couldn't delete this listing.");
    }
  }

  // ==========================================
  // PRODUCT DETAILS
  // ==========================================

  async function openProduct(product) {
    selectedProduct = product;
    replyingTo = null;

    if (!el.detail) return;

    el.detail.hidden = false;
    renderProductDetails(product);
    await loadComments(product.id);
    scrollTo(el.detail);
  }

  function renderProductDetails(product) {
    if (!el.detailContent) return;

    clear(el.detailContent);

    const layout = make("div", "product-detail-layout");

    let image;

    if (product.image_path) {
      image = make("img", "product-detail-image");
      image.src = publicImage(product.image_path);
      image.alt = product.title;
    } else {
      image = make("div", "product-image-placeholder", "✳");
    }

    const info = make("div", "product-detail-info");

    info.append(
      make("span", "eyebrow", product.category || "Marketplace item"),
      make("h2", "", product.title),
      make("strong", "detail-price", formatMoney(product.price)),
      make("p", "", product.description || "No description provided."),
      make("p", "", `⌖ ${product.location || "Location not specified"}`),
      make(
        "p",
        "",
        `Seller: ${product.seller_display_name || "ORBIT student"}`
      ),
      make(
        "p",
        "",
        product.seller_institution || "ORBIT marketplace"
      ),
      make("small", "", `Listed ${formatDate(product.created_at)}`)
    );

    const actions = make("div", "product-detail-actions");

    const like = make(
      "button",
      "secondary-button",
      likes[product.id]?.liked ? "♥ Liked" : "♡ Like"
    );

    like.type = "button";
    like.addEventListener("click", () => toggleLike(product));
    actions.append(like);

    if (product.seller_id === currentUser.id) {
      const edit = make("button", "secondary-button", "Edit listing");
      edit.type = "button";
      edit.addEventListener("click", () => openListing(product));

      const remove = make("button", "secondary-button", "Delete listing");
      remove.type = "button";
      remove.addEventListener("click", () => deleteProduct(product));

      actions.append(edit, remove);

    } else {
      const contact = make("button", "primary-button", "Message seller");
      contact.type = "button";
      contact.addEventListener("click", () => startConversation(product));

      const report = make("button", "secondary-button", "Report listing");
      report.type = "button";
      report.addEventListener("click", () =>
        reportItem("product", product.id)
      );

      actions.append(contact, report);
    }

    const shop = make("button", "secondary-button", "View shop");
    shop.type = "button";
    shop.addEventListener("click", () => openShop(product.seller_id));

    actions.append(shop);
    info.append(actions);
    layout.append(image, info);
    el.detailContent.append(layout);
  }

  // ==========================================
  // COMMENTS AND REPLIES
  // ==========================================

  async function loadComments(productId) {
    if (!el.commentList) return;

    clear(el.commentList);

    if (el.commentStatus) {
      el.commentStatus.textContent = "Loading comments...";
    }

    try {
      const { data, error } = await supabase
        .from("marketplace_comments")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const comments = data || [];
      const commenterIds = [...new Set(comments.map(item => item.user_id).filter(Boolean))];

      if (commenterIds.length) {
        const { data: profiles } = await supabase
          .from("student_profiles")
          .select("user_id,display_name,full_name")
          .in("user_id", commenterIds);

        const profileMap = new Map(
          (profiles || []).map(profile => [profile.user_id, profile])
        );

        comments.forEach(comment => {
          const profile = profileMap.get(comment.user_id);
          comment.author_display_name =
            comment.author_display_name ||
            profile?.display_name ||
            profile?.full_name ||
            "ORBIT student";
        });
      }

      if (el.commentStatus) {
        el.commentStatus.textContent = comments.length
          ? `${comments.length} comments`
          : "No comments yet. Start the conversation!";
      }

      renderComments(comments);

    } catch (error) {
      console.error("Comments:", error);

      if (el.commentStatus) {
        el.commentStatus.textContent = "Couldn't load comments.";
      }
    }
  }

  function createComment(comment, isReply = false) {
    const item = make(
      "div",
      `comment-item ${isReply ? "comment-reply" : ""}`
    );

    const heading = make("div", "comment-heading");

    heading.append(
      make(
        "span",
        "comment-author",
        comment.author_display_name || "ORBIT student"
      ),
      make("span", "comment-date", formatDate(comment.created_at))
    );

    item.append(
      heading,
      make("p", "comment-content", comment.content)
    );

    const actions = make("div", "comment-actions");

    if (!isReply) {
      const reply = make("button", "", "Reply");
      reply.type = "button";

      reply.addEventListener("click", () => {
        replyingTo = comment.id;
        el.commentInput.placeholder = "Write your reply...";
        el.commentInput.focus();
      });

      actions.append(reply);
    }

    if (comment.user_id === currentUser.id) {
      const remove = make("button", "", "Delete");
      remove.type = "button";
      remove.addEventListener("click", () => deleteComment(comment));
      actions.append(remove);
    } else {
      const report = make("button", "", "Report");
      report.type = "button";
      report.addEventListener("click", () =>
        reportItem("comment", comment.id)
      );
      actions.append(report);
    }

    item.append(actions);
    return item;
  }

  function renderComments(comments) {
    clear(el.commentList);

    const topLevel = comments.filter(
      comment => !comment.parent_comment_id
    );

    topLevel.forEach(comment => {
      el.commentList.append(createComment(comment));

      comments
        .filter(reply => reply.parent_comment_id === comment.id)
        .forEach(reply => {
          el.commentList.append(createComment(reply, true));
        });
    });
  }

  async function publishComment(event) {
    event.preventDefault();

    if (!selectedProduct || !el.commentInput) return;

    const content = el.commentInput.value.trim();

    if (!content || content.length > 1000) {
      alert("Comments must be between 1 and 1000 characters.");
      return;
    }

    try {
      const { error } = await supabase
        .from("marketplace_comments")
        .insert({
          product_id: selectedProduct.id,
          user_id: currentUser.id,
          content,
          parent_comment_id: replyingTo
        });

      if (error) throw error;

      el.commentInput.value = "";
      el.commentInput.placeholder = "Add a comment...";
      replyingTo = null;

      await loadComments(selectedProduct.id);
      await loadProducts();

    } catch (error) {
      console.error("Publishing comment:", error);
      alert("Couldn't publish your comment.");
    }
  }

  async function deleteComment(comment) {
    if (comment.user_id !== currentUser.id) return;
    if (!confirm("Delete this comment?")) return;

    try {
      const { error } = await supabase
        .from("marketplace_comments")
        .delete()
        .eq("id", comment.id)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      await loadComments(selectedProduct.id);
      await loadProducts();

    } catch (error) {
      console.error("Deleting comment:", error);
      alert("Couldn't delete this comment.");
    }
  }

  // ==========================================
  // REPORTS
  // ==========================================

  async function reportItem(targetType, targetId) {
    const reason = prompt("Why are you reporting this?");

    if (!reason?.trim()) return;

    try {
      const { error } = await supabase
        .from("marketplace_reports")
        .insert({
          reporter_id: currentUser.id,
          target_type: targetType,
          target_id: targetId,
          reason: reason.trim().slice(0, 500)
        });

      if (error) throw error;

      alert("Your report has been submitted.");

    } catch (error) {
      console.error("Reporting:", error);
      alert("Couldn't submit your report.");
    }
  }

  // ==========================================
  // SELLER SHOP
  // ==========================================

  function openShop(sellerId) {
    if (!el.shop) return;

    el.shop.hidden = false;
    clear(el.shopGrid);

    const ownShop = sellerId === currentUser.id;

    const sellerProducts = products.filter(
      product => product.seller_id === sellerId
    );

    const first = sellerProducts[0];

    if (el.shopName) {
      el.shopName.textContent = ownShop
        ? displayName()
        : first?.seller_display_name || "ORBIT student";
    }

    if (el.shopInstitution) {
      el.shopInstitution.textContent = ownShop
        ? studentProfile.university || "ORBIT student"
        : first?.seller_institution || "ORBIT marketplace";
    }

    if (el.shopAvatar) {
      el.shopAvatar.textContent = initials(el.shopName?.textContent);
    }

    if (!sellerProducts.length) {
      el.shopGrid.append(
        make("p", "", "No listings are available in this shop yet.")
      );
    } else {
      sellerProducts.forEach(product => {
        el.shopGrid.append(createProductCard(product));
      });
    }

    scrollTo(el.shop);
  }

  // ==========================================
  // SELLER DASHBOARD
  // ==========================================

  async function loadSellerStats() {
    if (!el.sellerDashboard || !currentUser) return;

    const ownProducts = products.filter(
      product => product.seller_id === currentUser.id
    );

    const ids = ownProducts.map(product => product.id);

    let likeCount = 0;
    let commentCount = 0;

    if (ids.length) {
      const [likeResult, commentResult] = await Promise.all([
        supabase
          .from("marketplace_likes")
          .select("id", { count: "exact", head: true })
          .in("product_id", ids),

        supabase
          .from("marketplace_comments")
          .select("id", { count: "exact", head: true })
          .in("product_id", ids)
      ]);

      likeCount = likeResult.count || 0;
      commentCount = commentResult.count || 0;
    }

    if (el.sellerProductCount) {
      el.sellerProductCount.textContent = ownProducts.length;
    }

    if (el.sellerLikeCount) {
      el.sellerLikeCount.textContent = likeCount;
    }

    if (el.sellerCommentCount) {
      el.sellerCommentCount.textContent = commentCount;
    }

    el.sellerDashboard.hidden = false;
  }

  // ==========================================
  // PRIVATE MESSAGING
  // ==========================================

  async function startConversation(product) {
    if (product.seller_id === currentUser.id) {
      alert("You cannot message yourself.");
      return;
    }

    try {
      const { data: existing, error: findError } = await supabase
        .from("marketplace_conversations")
        .select("*")
        .eq("product_id", product.id)
        .eq("buyer_id", currentUser.id)
        .maybeSingle();

      if (findError) throw findError;

      let conversation = existing;

      if (!conversation) {
        const { data, error } = await supabase
          .from("marketplace_conversations")
          .insert({
            product_id: product.id,
            buyer_id: currentUser.id,
            seller_id: product.seller_id
          })
          .select()
          .single();

        if (error) throw error;
        conversation = data;
      }

      await openMessages(conversation.id);

    } catch (error) {
      console.error("Starting conversation:", error);
      alert("Couldn't start this conversation. Messaging may be blocked.");
    }
  }

  async function openMessages(preferredId = null) {
    if (!el.messages) return;

    el.messages.hidden = false;
    scrollTo(el.messages);

    await loadConversations(preferredId);
  }

  async function loadConversations(preferredId = null) {
    clear(el.conversationList);

    const { data, error } = await supabase
      .from("marketplace_conversations")
      .select("*")
      .or(
        `buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Conversations:", error);
      el.conversationList.append(
        make("p", "", "Couldn't load conversations.")
      );
      return;
    }

    conversations = data || [];

    if (!conversations.length) {
      el.conversationList.append(
        make("p", "", "Your conversations will appear here.")
      );
      return;
    }

    const ids = [...new Set(
      conversations.map(item => item.product_id)
    )];

    const { data: relatedProducts } = await supabase
      .from("marketplace_products")
      .select("id,title,seller_display_name")
      .in("id", ids);

    const productMap = new Map(
      (relatedProducts || []).map(item => [item.id, item])
    );

    conversations.forEach(conversation => {
      const product = productMap.get(conversation.product_id);
      const buyer = conversation.buyer_id === currentUser.id;

      const button = make(
        "button",
        "conversation-item",
        ""
      );

      button.type = "button";

      button.append(
        make(
          "strong",
          "",
          product?.title || "Marketplace conversation"
        ),
        make(
          "small",
          "",
          buyer
            ? `Seller: ${product?.seller_display_name || "ORBIT student"}`
            : "Buyer conversation"
        )
      );

      button.addEventListener("click", () =>
        selectConversation(conversation, product)
      );

      el.conversationList.append(button);
    });

    const target = conversations.find(
      item => item.id === preferredId
    );

    if (target) {
      await selectConversation(
        target,
        productMap.get(target.product_id)
      );
    } else if (
      selectedConversation &&
      conversations.some(
        item => item.id === selectedConversation.id
      )
    ) {
      await selectConversation(
        selectedConversation,
        productMap.get(selectedConversation.product_id)
      );
    } else {
      selectedConversation = null;
      clear(el.messageList);

      if (el.conversationHeader) {
        el.conversationHeader.textContent = "Select a conversation";
      }
    }
  }

  async function selectConversation(conversation, product) {
    selectedConversation = conversation;

    if (activeMessageChannel) {
      await supabase.removeChannel(activeMessageChannel);
      activeMessageChannel = null;
    }

    if (el.conversationHeader) {
      el.conversationHeader.textContent =
        product?.title || "Marketplace conversation";
    }

    await loadMessages(conversation.id);

    activeMessageChannel = supabase
      .channel(`orbit-market-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "marketplace_messages",
          filter: `conversation_id=eq.${conversation.id}`
        },
        () => loadMessages(conversation.id)
      )
      .subscribe();
  }

  async function loadMessages(conversationId) {
    const { data, error } = await supabase
      .from("marketplace_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages:", error);
      return;
    }

    clear(el.messageList);

    (data || []).forEach(item => {
      const mine = item.sender_id === currentUser.id;

      const bubble = make(
        "div",
        `message-bubble ${mine ? "mine" : ""}`
      );

      bubble.append(
        make("p", "", item.content),
        make("small", "message-time", formatTime(item.created_at))
      );

      el.messageList.append(bubble);
    });

    el.messageList.scrollTop = el.messageList.scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!selectedConversation) {
      alert("Choose a conversation first.");
      return;
    }

    const content = el.messageInput.value.trim();

    if (!content || content.length > 3000) {
      alert("Messages must be between 1 and 3000 characters.");
      return;
    }

    try {
      const { error } = await supabase
        .from("marketplace_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUser.id,
          content
        });

      if (error) throw error;

      el.messageInput.value = "";
      await loadMessages(selectedConversation.id);

    } catch (error) {
      console.error("Sending message:", error);
      alert("Couldn't send your message.");
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  function setupEvents() {
    // Search
    el.search?.addEventListener("input", renderProducts);

    el.clearSearch?.addEventListener("click", () => {
      el.search.value = "";
      renderProducts();
    });

    // Category filters
    $$("[data-category]").forEach(button => {
      button.addEventListener("click", () => {
        selectedCategory = button.dataset.category || "All";

        $$("[data-category]").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        renderProducts();
      });
    });

    // Feed tabs
    $$("[data-market-filter]").forEach(button => {
      button.addEventListener("click", () => {
        selectedFeed = button.dataset.marketFilter || "all";

        $$("[data-market-filter]").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        renderProducts();
      });
    });

    el.institution?.addEventListener("change", renderProducts);
    el.sort?.addEventListener("change", renderProducts);

    // Filter panel
    el.filterToggle?.addEventListener("click", () => {
      if (el.filterPanel) {
        el.filterPanel.hidden = !el.filterPanel.hidden;
      }
    });

    // Create listings
    $("#openListingButton")?.addEventListener(
      "click",
      () => openListing()
    );

    $("#emptySellButton")?.addEventListener(
      "click",
      () => openListing()
    );

    $("#sellerCreateListingButton")?.addEventListener(
      "click",
      () => openListing()
    );

    $("#closeListingButton")?.addEventListener(
      "click",
      closeListing
    );

    $("#cancelListingButton")?.addEventListener(
      "click",
      closeListing
    );

    el.listingForm?.addEventListener("submit", publishProduct);

    el.imageInput?.addEventListener("change", event => {
      handleImage(event.target.files?.[0]);
    });

    el.removeImage?.addEventListener("click", () => {
      selectedImageFile = null;
      el.imageInput.value = "";
      clear(el.imagePreview);
      if (el.imagePreview) el.imagePreview.hidden = true;
      el.imageArea?.classList.remove("has-image");
    });

    // Product details
    $("#closeProductDetailButton")?.addEventListener("click", () => {
      el.detail.hidden = true;
      selectedProduct = null;
    });

    el.commentForm?.addEventListener("submit", publishComment);

    el.commentInput?.addEventListener("keydown", event => {
      if (event.key === "Escape" && replyingTo) {
        replyingTo = null;
        el.commentInput.placeholder = "Add a comment...";
      }
    });

    // Messages
    $("#openMessagesButton")?.addEventListener(
      "click",
      () => openMessages()
    );

    $("#closeMessagesButton")?.addEventListener("click", async () => {
      if (activeMessageChannel) {
        await supabase.removeChannel(activeMessageChannel);
        activeMessageChannel = null;
      }

      el.messages.hidden = true;
    });

    el.messageForm?.addEventListener("submit", sendMessage);

    // Shop
    $("#closeShopButton")?.addEventListener("click", () => {
      el.shop.hidden = true;
    });

    el.avatar?.addEventListener("click", () =>
      openShop(currentUser.id)
    );

    // Explore products
    $("#exploreProductsButton")?.addEventListener("click", () => {
      scrollTo(el.grid);
    });

    // Refresh
    $("#refreshFeedButton")?.addEventListener("click", loadProducts);

    // Clear filters
    $("#clearFiltersButton")?.addEventListener("click", () => {
      selectedCategory = "All";
      selectedFeed = "all";

      if (el.search) el.search.value = "";
      if (el.institution) el.institution.value = "";
      if (el.sort) el.sort.value = "newest";

      $$("[data-category]").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.category === "All"
        );
      });

      $$("[data-market-filter]").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.marketFilter === "all"
        );
      });

      renderProducts();
    });
  }

  // ==========================================
  // START
  // ==========================================

  initialise();
});