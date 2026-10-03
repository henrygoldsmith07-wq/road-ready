/* Road Ready service worker — offline-first cache with deterministic versioning.
 *
 * Cache name strategy: the VERSION below is GENERATED from a content hash of
 * every precached shell file by scripts/update-sw.mjs (wired into `npm test`
 * and CI). Any changed byte in any shell asset produces a new cache name, so a
 * deployed update can never leave users serving an old shell from a cache that
 * a human forgot to bump. Do not edit VERSION by hand.
 *
 * Update flow: a newly installed worker waits (browser default). The page
 * sends it "skip-waiting", it activates, deletes every older cache, claims
 * clients, and the page shows a "Reload" toast. Mixed old/new asset versions
 * are avoided by rebuilding the whole cache per version and deleting the rest.
 *
 * API responses can contain signed-in account details and the user's synced
 * backup. They must always go directly to the network and must never enter
 * Cache Storage, where a later account in the same browser could read a
 * previous account's response.
 */
"use strict";

// scripts/update-sw.mjs rewrites the line below — do not edit by hand.
const VERSION = "v.e944ae6597d9";
const CACHE = `roadready-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-maskable.svg",
  "css/styles.css",
  "js/boot-error.js",
  "js/core.js",
  "js/mastery.js",
  "js/explain.js",
  "js/evidence.js",
  "js/coach.js",
  "js/concept-map-ui.js",
  "js/format.js",
  "js/jurisdictions.js",
  "js/packs/uk.js",
  "js/state-packs.js",
  "js/exam-blueprints.js",
  "js/icons.js",
  "js/questions.js",
  "js/signs.js",
  "js/account.js",
  "js/account-ui.js",
  "js/practical-ui.js",
  "js/study-ui.js",
  "js/flashcards-ui.js",
  "js/review-ui.js",
  "js/results-ui.js",
  "js/home-ui.js",
  "js/quiz-ui.js",
  "js/hazard-scenarios.js",
  "js/hazard-ui.js",
  "css/hazard.css",
  "js/guide.js",
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

// The page asks a freshly installed worker to take over right away, instead of
// leaving users on the old controller until every tab happens to close.
self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // API responses can contain signed-in account details and the user's full
  // synced backup. They must always go directly to the network and must never
  // enter Cache Storage, where a later account in the same browser could read
  // a previous account's response.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

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
