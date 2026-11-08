
document.addEventListener("DOMContentLoaded", () => {

  // =====================================
  // ORBIT FIRST-LAUNCH INTRO
  // =====================================

  const intro = document.querySelector("#orbitIntro");
  const skipIntro = document.querySelector("#skipIntro");
  const introKey = "orbitIntroSeen_v1";

  if (intro) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let finished = false;
    const hasSeenIntro = (() => {
      try { return localStorage.getItem(introKey) === "yes"; }
      catch (_) { return false; }
    })();

    // Give first-time visitors room to enjoy the full solar-system reveal. Returning visitors get a shorter brand moment.
    const introDuration = reducedMotion ? 650 : (hasSeenIntro ? 1800 : 7600);

    function finishIntro() {
      if (finished) return;
      finished = true;
      intro.classList.add("is-leaving");
      try { localStorage.setItem(introKey, "yes"); } catch (_) {}
      window.setTimeout(() => {
        intro.classList.add("is-gone");
        intro.setAttribute("aria-hidden", "true");
      }, 950);
    }

    if (skipIntro) skipIntro.addEventListener("click", finishIntro);
    window.setTimeout(finishIntro, introDuration);
  }

  // =====================================
  // ORBIT MOBILE NAVIGATION
  // =====================================

  const menuToggle = document.querySelector("#menuToggle");
  const navigation = document.querySelector("#navigation");

  function closeMenu() {
    if (!menuToggle || !navigation) return;

    menuToggle.classList.remove("active");
    navigation.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    document.body.classList.remove("menu-open");
  }

  if (menuToggle && navigation) {

    menuToggle.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("open");

      menuToggle.classList.toggle("active", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation" : "Open navigation"
      );

      document.body.classList.toggle("menu-open", isOpen);
    });

    navigation.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) {
        closeMenu();
      }
    });
  }


  // =====================================
  // SCROLL REVEAL ANIMATIONS
  // =====================================

  const revealElements = document.querySelectorAll(
    ".hero-copy, .hero-visual, .intro-strip, " +
    ".section-intro, .feature-card, " +
    ".community-copy, .final-cta, .site-footer"
  );

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if ("IntersectionObserver" in window && !reducedMotion) {

    revealElements.forEach(element => {
      element.classList.add("reveal");
    });

    document.documentElement.classList.add("js-ready");

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {

        entries.forEach(entry => {

          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }

        });

      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -35px 0px"
      }
    );

    revealElements.forEach(element => {
      revealObserver.observe(element);
    });

  }


  // =====================================
  // ORBIT INTERACTIVE MOVEMENT
  // =====================================

  const orbitSystem = document.querySelector(".orbit-system");

  const floatingCards = document.querySelectorAll(".floating-card");

  const canUsePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  if (orbitSystem && canUsePointer && !reducedMotion) {

    orbitSystem.addEventListener("pointermove", event => {

      const bounds = orbitSystem.getBoundingClientRect();

      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;

      const moveX = (event.clientX - centerX) / bounds.width;
      const moveY = (event.clientY - centerY) / bounds.height;

      floatingCards.forEach((card, index) => {

        const intensity = (index + 1) * 7;

        card.style.setProperty(
          "--move-x",
          `${moveX * intensity}px`
        );

        card.style.setProperty(
          "--move-y",
          `${moveY * intensity}px`
        );

      });

    });

    orbitSystem.addEventListener("pointerleave", () => {

      floatingCards.forEach(card => {
        card.style.setProperty("--move-x", "0px");
        card.style.setProperty("--move-y", "0px");
      });

    });

  }


  // =====================================
  // CURRENT YEAR
  // =====================================

  const yearElement = document.querySelector("[data-current-year]");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }


  // =====================================
  // INITIALISE
  // =====================================

  console.log("ORBIT landing page initialised.");

});
/* ==========================================
   ORBIT CINEMATIC INTRO CONTROLLER
========================================== */

(function () {
    const intro = document.getElementById("orbit-intro");

    if (!intro || intro.dataset.initialized === "true") return;

    intro.dataset.initialized = "true";

    const skipButton = document.getElementById("orbit-skip");
    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    let introFinished = false;

    function closeOrbitIntro() {
        if (introFinished) return;

        introFinished = true;
        intro.classList.add("orbit-exit");

        window.setTimeout(() => {
            intro.remove();
        }, 1200);
    }

    skipButton?.addEventListener("click", closeOrbitIntro);

    // Reduced-motion users get a much shorter introduction.
    if (reducedMotion) {
        window.setTimeout(closeOrbitIntro, 1500);
    } else {
        // Full cinematic experience on every launch.
        window.setTimeout(closeOrbitIntro, 16000);
    }
})();