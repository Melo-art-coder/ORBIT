const CACHE_NAME = "orbit-static-v1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./pwa.js",

  "./style.css",
  "./script.js",

  "./auth.css",
  "./auth.js",

  "./app.css",
  "./app.js",

  "./login.css",
  "./login.js",

  "./signup.css",
  "./signup.js",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS)
    )
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("orbit-static-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept external requests or private Supabase data.
  if (
    url.origin !== self.location.origin ||
    /supabase|\/auth\/|\/rest\/v1\/|\/storage\/v1\/|\/functions\/v1\/|\/api\//i.test(url.href)
  ) {
    return;
  }

  // HTML pages: always try the network first.
  // If offline, show the offline page instead of stale account pages.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match("./offline.html");
      })
    );
    return;
  }

  // Static assets: cache first.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});