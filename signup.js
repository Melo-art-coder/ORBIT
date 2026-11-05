
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");

  if (!signupForm) return;

  const fullNameInput = document.getElementById("fullName");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const termsCheckbox = document.getElementById("terms");

  const signupButton = document.getElementById("signupButton");
  const signupMessage = document.getElementById("signupMessage");

  // =====================================
  // MESSAGE HANDLER
  // =====================================

  function showMessage(message, type = "error") {
    if (!signupMessage) return;

    signupMessage.textContent = message;
    signupMessage.className = `form-message show ${type}`;
  }

  function clearMessage() {
    if (!signupMessage) return;

    signupMessage.textContent = "";
    signupMessage.className = "form-message";
  }

  // =====================================
  // PASSWORD SHOW / HIDE
  // =====================================

  const passwordToggles = document.querySelectorAll(
    "[data-password-toggle]"
  );

  passwordToggles.forEach(button => {
    button.addEventListener("click", () => {
      const inputId = button.dataset.passwordToggle;
      const passwordField = document.getElementById(inputId);

      if (!passwordField) return;

      const shouldShow = passwordField.type === "password";

      passwordField.type = shouldShow ? "text" : "password";
      button.textContent = shouldShow ? "Hide" : "Show";
      button.setAttribute(
        "aria-label",
        shouldShow ? "Hide password" : "Show password"
      );
    });
  });

  // =====================================
  // CURRENT YEAR
  // =====================================

  const yearElement = document.querySelector("[data-current-year]");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // =====================================
  // LIVE PASSWORD MATCH CHECK
  // =====================================

  confirmPasswordInput.addEventListener("input", () => {
    clearMessage();

    if (
      confirmPasswordInput.value &&
      passwordInput.value !== confirmPasswordInput.value
    ) {
      confirmPasswordInput.setCustomValidity(
        "Your passwords do not match."
      );
    } else {
      confirmPasswordInput.setCustomValidity("");
    }
  });

  passwordInput.addEventListener("input", () => {
    confirmPasswordInput.setCustomValidity("");

    if (
      confirmPasswordInput.value &&
      passwordInput.value !== confirmPasswordInput.value
    ) {
      confirmPasswordInput.setCustomValidity(
        "Your passwords do not match."
      );
    }
  });

  // =====================================
  // SUBMIT BUTTON STATE
  // =====================================

  function setLoading(isLoading) {
    signupButton.disabled = isLoading;

    signupButton.querySelector("span:first-child").textContent =
      isLoading ? "Creating your account..." : "Create my account";

    signupButton.setAttribute("aria-busy", String(isLoading));
  }

  // =====================================
  // SIGNUP
  // =====================================

  signupForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessage();

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Basic validation

    if (!fullName || !email || !password || !confirmPassword) {
      showMessage("Please complete all the required fields.");
      return;
    }

    if (fullName.length < 2) {
      showMessage("Please enter your full name.");
      fullNameInput.focus();
      return;
    }

    if (password.length < 8) {
      showMessage("Your password must contain at least 8 characters.");
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Your passwords do not match.");
      confirmPasswordInput.focus();
      return;
    }

    if (!termsCheckbox.checked) {
      showMessage(
        "Please accept the Terms of Service and Privacy Policy to continue."
      );
      termsCheckbox.focus();
      return;
    }

    // Make sure shared authentication is available

    if (!window.orbitAuth || !window.orbitSupabase) {
      showMessage(
        "ORBIT authentication is not ready. Please refresh and try again."
      );
      console.error("ORBIT auth.js or Supabase client is unavailable.");
      return;
    }

    setLoading(true);

    try {
      // Use the shared Supabase authentication helper

      const result = await window.orbitAuth.signUp({
        fullName,
        email,
        password
      });

      if (!result || result.error) {
        throw result?.error || new Error(
          "We couldn't create your account. Please try again."
        );
      }

      const { data } = result;

      // If email confirmation is enabled, Supabase may not
      // create a session until the user verifies their email.

      if (data?.session) {
        showMessage(
          "Your account is ready! Taking you to your setup...",
          "success"
        );

        setTimeout(() => {
          window.location.href = new URL(
            "setup.html",
            window.location.href
          ).href;
        }, 1000);

        return;
      }

      // No session usually means email confirmation is required.

      showMessage(
        "Your account has been created! Please check your email and confirm your address before continuing.",
        "success"
      );

      signupButton.querySelector("span:first-child").textContent =
        "Account created";

    } catch (error) {
      console.error("ORBIT signup error:", error);

      let message = "Something went wrong. Please try again.";

      const errorText = String(error?.message || "").toLowerCase();

      if (
        errorText.includes("already registered") ||
        errorText.includes("already been registered") ||
        errorText.includes("user already registered")
      ) {
        message = "An account with this email already exists. Please log in instead.";
      } else if (
        errorText.includes("invalid email")
      ) {
        message = "Please enter a valid email address.";
      } else if (
        errorText.includes("password") &&
        errorText.includes("weak")
      ) {
        message = "Please choose a stronger password.";
      } else if (
        errorText.includes("network") ||
        errorText.includes("fetch")
      ) {
        message = "Connection problem. Check your internet and try again.";
      } else if (error?.message) {
        message = error.message;
      }

      showMessage(message);

    } finally {
      setLoading(false);
    }
  });

});
