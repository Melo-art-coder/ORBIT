(() => {
  if (!("serviceWorker" in navigator)) return;

  let deferredPrompt = null;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  function showNotice(message, buttonText, action) {
    if (document.getElementById("orbit-pwa-notice")) return;

    const box = document.createElement("div");
    box.id = "orbit-pwa-notice";

    box.style.cssText = `
      position:fixed;
      z-index:99999;
      bottom:20px;
      left:16px;
      right:16px;
      max-width:500px;
      margin:auto;
      padding:17px;
      border-radius:16px;
      background:#29241f;
      color:#fffdf8;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      font:14px system-ui;
      box-shadow:0 8px 30px rgba(0,0,0,.2);
    `;

    const text = document.createElement("span");
    text.textContent = message;

    box.appendChild(text);

    if (buttonText && action) {
      const button = document.createElement("button");

      button.textContent = buttonText;
      button.style.cssText = `
        padding:10px 15px;
        border:0;
        border-radius:30px;
        background:#eee4ca;
        color:#29241f;
        font-weight:700;
        cursor:pointer;
      `;

      button.addEventListener("click", action);
      box.appendChild(button);
    }

    const close = document.createElement("button");
    close.textContent = "×";
    close.style.cssText = `
      border:0;
      background:transparent;
      color:white;
      font-size:23px;
      cursor:pointer;
    `;

    close.addEventListener("click", () => box.remove());

    box.appendChild(close);
    document.body.appendChild(box);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;

    if (isStandalone) return;

    let dismissed = false;

    try {
      dismissed =
        localStorage.getItem("orbitInstallDismissed") === "yes";
    } catch (_) {}

    if (dismissed) return;

    setTimeout(() => {
      showNotice(
        "Install ORBIT and take your academic universe with you.",
        "Install",
        async () => {
          if (!deferredPrompt) return;

          await deferredPrompt.prompt();
          await deferredPrompt.userChoice;

          deferredPrompt = null;

          document.getElementById("orbit-pwa-notice")?.remove();
        }
      );
    }, 3000);
  });

  // iPhone installation instructions.
  if (isIOS && !isStandalone) {
    setTimeout(() => {
      showNotice(
        "To install ORBIT, tap Share in Safari, then Add to Home Screen.",
        null,
        null
      );
    }, 3000);
  }

  // Register service worker.
  navigator.serviceWorker.register("./service-worker.js")
    .then(registration => {

      if (registration.waiting) {
        showUpdate(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;

        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdate(registration.waiting || worker);
          }
        });
      });

    })
    .catch(error => {
      console.error("ORBIT PWA registration failed:", error);
    });

  function showUpdate(worker) {
    showNotice(
      "A new version of ORBIT is ready.",
      "Update",
      () => {
        worker.postMessage({
          type: "SKIP_WAITING"
        });
      }
    );
  }

  let refreshed = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshed) return;

    refreshed = true;
    window.location.reload();
  });

})();