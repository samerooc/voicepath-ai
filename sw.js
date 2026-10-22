/**
 * VoicePath AI: Service Worker for Offline Navigation
 * Caches core shell and demo map so blind users can navigate without internet.
 */

const CACHE_NAME = "voicepath-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./admin.html",
  "./guard.html",
  "./css/style.css",
  "./data/map.json",
  "./js/app.js",
  "./js/state.js",
  "./js/mapLoader.js",
  "./js/mapValidator.js",
  "./js/router.js",
  "./js/directions.js",
  "./js/i18n.js",
  "./js/voice.js",
  "./js/ui.js",
  "./js/guard.js",
  "./js/safety.js",
  "./js/sensors.js",
  "./js/qr.js",
  "./js/haptics.js",
  "./js/admin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Caching core assets for offline usage.");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] Removing stale cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback for offline navigation
        if (event.request.destination === "document") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
