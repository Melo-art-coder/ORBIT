
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const loginForm = document.querySelector("#loginForm");
  const emailInput = document.querySelector("#email");
  const passwordInput = document.querySelector("#password");
  const rememberInput = document.querySelector("#rememberMe");
  const loginButton = document.querySelector("#loginButton");
  const message = document.querySelector("#loginMessage");

  function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `form-message show ${type}`;
  }

  function hideMessage() {
    if (!message) return;

    message.textContent = "";
    message.className = "form-message";
  }

  function setLoading(loading) {
    if (!loginButton) return;

    loginButton.disabled = loading;
    loginButton.textContent = loading
      ? "Signing you in..."
      : "Log in";
  }

  // Password visibility toggle.
  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.passwordToggle;
      const passwordField = document.getElementById(targetId);

      if (!passwordField) return;

      const isPassword = passwordField.type === "password";

      passwordField.type = isPassword ? "text" : "password";

      button.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
      );

      button.setAttribute("aria-pressed", String(isPassword));
    });
  });

  if (!window.orbitAuth || !window.orbitSupabase) {
    showMessage("ORBIT authentication is unavailable. Please refresh.");
    return;
  }

  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    hideMessage();

    const email = emailInput?.value.trim().toLowerCase() || "";
    const password = passwordInput?.value || "";

    if (!email || !password) {
      showMessage("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await window.orbitAuth.signIn({
        email,
        password
      });

      if (error) throw error;

      if (!data?.user) {
        throw new Error("We couldn't verify your account. Please try again.");
      }

      // Store the user's remember preference.
      if (rememberInput?.checked) {
        localStorage.setItem("orbitRememberMe", "true");
      } else {
        localStorage.removeItem("orbitRememberMe");
      }

      const { data: profile, error: profileError } =
        await window.orbitSupabase
          .from("student_profiles")
          .select("setup_completed")
          .eq("user_id", data.user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.setup_completed === true) {
        showMessage("Welcome back! Opening your ORBIT...", "success");

        setTimeout(() => {
          window.location.replace("app.html");
        }, 700);

      } else {
        showMessage("Welcome to ORBIT! Let's complete your profile.", "success");

        setTimeout(() => {
          window.location.replace("setup.html");
        }, 700);
      }

    } catch (error) {
      console.error("ORBIT login error:", error);

      let errorMessage = "Login failed. Please try again.";

      if (
        error.message?.toLowerCase().includes("invalid login credentials")
      ) {
        errorMessage = "Incorrect email or password. Please check and try again.";
      } else if (
        error.message?.toLowerCase().includes("email not confirmed")
      ) {
        errorMessage = "Please confirm your email before logging in.";
      } else if (
        error.message?.toLowerCase().includes("network")
      ) {
        errorMessage = "Connection problem. Check your internet and retry.";
      }

      showMessage(errorMessage);

    } finally {
      setLoading(false);
    }
  });

  console.log("ORBIT login system ready.");
});
