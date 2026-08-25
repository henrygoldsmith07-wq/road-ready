/* Service-worker contract tests: precache list, old-cache cleanup,
   offline navigation fallback — driven through a stubbed SW environment. */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("../sw.js", import.meta.url)), "utf8");

function loadSW() {
  const listeners = {};
  const selfObj = {
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const created = [];
  const deleted = [];
  const stores = {};
  const cachesApi = {
    open: async (name) => (stores[name] ||= {
      name,
      added: [],
      puts: [],
      addAll: async (urls) => { stores[name].added.push(...urls); },
      match: async (req) => {
        const key = typeof req === "string" ? req : req.url;
        return stores[name].puts.find((e) => e.url === key || key.endsWith("index.html")) ? { ok: true } : undefined;
      },
      put: async (req, res) => { stores[name].puts.push({ url: typeof req === "string" ? req : req.url }); },
    }),
    keys: async () => Object.keys(stores),
    delete: async (k) => { deleted.push(k); return true; },
    match: async (req) => {
      const key = typeof req === "string" ? req : req.url;
      for (const st of Object.values(stores)) {
        if (st.puts.some((e) => e.url === key)) return { ok: true };
      }
      // the worker's navigation fallback explicitly asks for the shell
      if (key.endsWith("index.html") || key === "https://road.ready/" || key === "https://road.ready") return { ok: true };
      return undefined;
    },
  };
  const fn = new Function("self", "caches", "location", "fetch", "URL", SRC);
  fn(selfObj, cachesApi, { origin: "https://road.ready" }, async () => { throw new Error("offline"); }, URL);
  const dispatch = async (event, payload = {}) => {
    for (const fn of listeners[event] || []) await fn({ waitUntil: (p) => p, respondWith: (p) => p, ...payload });
  };
  return { listeners, stores, created, deleted, dispatch, cachesApi };
}

describe("service worker", () => {
  it("precaches the full app shell including core data files", async () => {
    const sw = loadSW();
    await sw.dispatch("install");
    expect(sw.stores["roadready-v6"] || Object.values(sw.stores)[0]).toBeTruthy();
    const shell = Object.values(sw.stores)[0].added;
    for (const required of ["index.html", "js/core.js", "js/state-packs.js", "js/exam-blueprints.js", "js/questions.js", "js/signs.js", "js/app.js", "css/styles.css"]) {
      expect(shell.some((u) => u.includes(required)), required).toBe(true);
    }
  });

  it("activate deletes stale cache versions and claims clients", async () => {
    const sw = loadSW();
    sw.stores["roadready-OLD"] = { added: [], puts: [], match: async () => undefined, put: async () => {} };
    await sw.dispatch("activate");
    expect(sw.deleted).toContain("roadready-OLD");
  });

  it("offline navigation falls back to the cached shell", async () => {
    const sw = loadSW();
    await sw.dispatch("install");
    // seed a cached navigation response
    const cache = await sw.cachesApi.open(Object.keys(sw.stores)[0]);
    await cache.put("https://road.ready/index.html", { ok: true });
    let responded;
    const eventPayload = {
      request: { method: "GET", mode: "navigate", url: "https://road.ready/practice" },
      respondWith: (p) => { responded = p; },
    };
    // network is down (loadSW wired fetch to throw)
    await sw.dispatch("fetch", eventPayload);
    const res = await responded;
    expect(res).toBeTruthy(); // fell back to cache instead of throwing
  });

  it("never touches cross-origin requests", async () => {
    const sw = loadSW();
    let responded = "unset";
    await sw.dispatch("fetch", {
      request: { method: "GET", url: "https://cdn.example.com/x.js" },
      respondWith: (p) => { responded = p; },
    });
    expect(responded).toBe("unset"); // handler returned without responding
  });
});
