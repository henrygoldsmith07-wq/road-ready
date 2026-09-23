/* Road Ready service worker Ã¢â‚¬â€ offline-first cache.
   Strategy: precache the app shell; serve cache-first with a background
   network refresh (stale-while-revalidate) for same-origin GETs. */
"use strict";

const VERSION = "v6";
const CACHE = `roadready-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-maskable.svg",
  "css/styles.css",
  "js/core.js",
  "js/jurisdictions.js",
  "js/state-packs.js",
  "js/exam-blueprints.js",
  "js/icons.js",
  "js/questions.js",
  "js/signs.js",
  "js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigations: try network, fall back to cached shell (works offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
    return;
  }

  // Assets: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
