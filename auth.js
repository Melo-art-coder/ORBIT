
/* =========================================
   ORBIT — SHARED AUTHENTICATION ENGINE
   Supabase Authentication
========================================= */

(() => {
  "use strict";

  // =====================================
  // 1. SUPABASE CONFIGURATION
  // =====================================

  const SUPABASE_URL =
    "https://jpwlqibywqpicacvhfmn.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_kcDYoXOhBg-ojKtlxpnf4w_KDgJzkI2";

  // =====================================
  // 2. CHECK SUPABASE LIBRARY
  // =====================================

  if (!window.supabase || !window.supabase.createClient) {
    console.error(
      "ORBIT: Supabase library could not be loaded."
    );

    window.orbitAuthError =
      "Authentication service could not be loaded.";

    return;
  }

  // =====================================
  // 3. CREATE ONE SHARED CLIENT
  // =====================================

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );

  // Make the client available to ORBIT pages.
  window.orbitSupabase = supabaseClient;

  // =====================================
  // 4. HELPER: GET SETUP PAGE URL
  // =====================================

  function getSetupUrl() {
    return new URL("setup.html", window.location.href).href;
  }

  // =====================================
  // 5. SIGN UP
  // =====================================

  async function signUp({ fullName, email, password }) {
    try {
      const { data, error } =
        await supabaseClient.auth.signUp({
          email,
          password,

          options: {
            data: {
              full_name: fullName
            },

            emailRedirectTo: getSetupUrl()
          }
        });

      if (error) {
        throw error;
      }

      return {
        data,
        error: null
      };

    } catch (error) {
      console.error("ORBIT signup:", error);

      return {
        data: null,
        error
      };
    }
  }

  // =====================================
  // 6. LOG IN
  // =====================================

  async function signIn({ email, password }) {
    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        throw error;
      }

      return {
        data,
        error: null
      };

    } catch (error) {
      console.error("ORBIT login:", error);

      return {
        data: null,
        error
      };
    }
  }

  // =====================================
  // 7. GET CURRENT SESSION
  // =====================================

  async function getSession() {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  }

  // =====================================
  // 8. GET CURRENT USER
  // =====================================

  async function getUser() {
    const { data, error } =
      await supabaseClient.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user;
  }

  // =====================================
  // 9. LOG OUT
  // =====================================

  async function signOut() {
    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    localStorage.removeItem("orbitRememberMe");

    window.location.href = new URL(
      "index.html",
      window.location.href
    ).href;
  }

  // =====================================
  // 10. PASSWORD RECOVERY
  // =====================================

  async function resetPassword(email) {
    const { data, error } =
      await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: new URL(
            "reset-password.html",
            window.location.href
          ).href
        }
      );

    if (error) {
      throw error;
    }

    return data;
  }

  // =====================================
  // 11. UPDATE PASSWORD
  // =====================================

  async function updatePassword(newPassword) {
    const { data, error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    if (error) {
      throw error;
    }

    return data;
  }

  // =====================================
  // 12. AUTHENTICATION STATE LISTENER
  // =====================================

  function onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );
  }

  // =====================================
  // 13. EXPOSE ORBIT AUTH FUNCTIONS
  // =====================================

  window.orbitAuth = {
    signUp,
    signIn,
    getSession,
    getUser,
    signOut,
    resetPassword,
    updatePassword,
    onAuthStateChange
  };

  console.log("ORBIT authentication engine ready.");

})();
