/* Backend hardening: session revocation, input bounds, rate limiting, and
 * route-level coverage for the OAuth handlers.
 *
 * The OAuth routes previously had no route-level tests at all — only their
 * library helpers were covered, so a regression in the state check, the
 * method guard or the error copy would not have been caught. */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

process.env.AUTH_SECRET = "backend-hardening-secret-value-long-enough";
process.env.NODE_ENV = "test";

const db = vi.hoisted(() => ({
  findUserById: vi.fn(),
  readState: vi.fn(),
  readStateMeta: vi.fn(),
  writeState: vi.fn(),
  deleteState: vi.fn(),
  deleteUser: vi.fn(),
  revokeSessions: vi.fn(),
  upsertGoogleUser: vi.fn(),
}));

vi.mock("../api/_lib/db.js", () => ({
  DatabaseNotConfigured: class DatabaseNotConfigured extends Error {},
  findUserById: db.findUserById,
  readState: db.readState,
  readStateMeta: db.readStateMeta,
  writeState: db.writeState,
  deleteState: db.deleteState,
  deleteUser: db.deleteUser,
  revokeSessions: db.revokeSessions,
  upsertGoogleUser: db.upsertGoogleUser,
}));

const { issueSession, SESSION_COOKIE, readSessionPayload } = await import("../api/_lib/session.js");
const { default: syncHandler } = await import("../api/sync.js");
const { default: accountHandler } = await import("../api/account.js");
const { default: signoutHandler } = await import("../api/auth/signout.js");
const { default: googleHandler } = await import("../api/auth/google.js");
const { default: callbackHandler } = await import("../api/auth/callback.js");
const { callerKey, hit, resetLimiter } = await import("../api/_lib/ratelimit.js");

function res() {
  const headers = {};
  return {
    statusCode: 200, body: "", headers,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(body = "") { this.body = String(body); },
  };
}
function json(res_) { return res_.body ? JSON.parse(res_.body) : null; }

function req(method, path, body, extra = {}) {
  const stream = Readable.from(body == null ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))]);
  stream.method = method;
  stream.url = path;
  stream.headers = {
    host: "road.ready",
    origin: "https://road.ready",
    cookie: `${SESSION_COOKIE}=${issueSession("user-1")}`,
    "content-type": body == null ? "" : "application/json",
    ...extra,
  };
  return stream;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLimiter();
  db.findUserById.mockResolvedValue({ id: "user-1", email: "person@example.com" });
  db.readState.mockResolvedValue({ payload: { bundle: "{}" }, updated_at: "2026-01-01T00:00:00Z", revision: "4" });
  db.readStateMeta.mockResolvedValue({ updated_at: "2026-01-01T00:00:00Z", revision: "4" });
  db.writeState.mockResolvedValue({ updated_at: "2026-01-01T00:00:01Z", revision: "5" });
});

describe("session revocation", () => {
  it("exposes the issued-at time so a revoked session can be recognised", () => {
    const payload = readSessionPayload(issueSession("user-1"));
    expect(payload.uid).toBe("user-1");
    expect(typeof payload.iat).toBe("number");
  });

  it("refuses a session issued before the account was revoked", async () => {
    db.findUserById.mockResolvedValue({
      id: "user-1",
      revoked_before: new Date(Date.now() + 60_000).toISOString(),
    });
    const response = res();
    await syncHandler(req("GET", "/api/sync"), response);
    expect(response.statusCode).toBe(401);
    expect(json(response).error).toMatch(/Not signed in/);
  });

  it("allows a session issued after the account was revoked", async () => {
    db.findUserById.mockResolvedValue({
      id: "user-1",
      revoked_before: new Date(Date.now() - 60_000).toISOString(),
    });
    const response = res();
    await syncHandler(req("GET", "/api/sync"), response);
    expect(response.statusCode).toBe(200);
  });

  it("refuses a revoked session on the account route too", async () => {
    db.findUserById.mockResolvedValue({
      id: "user-1",
      revoked_before: new Date(Date.now() + 60_000).toISOString(),
    });
    const response = res();
    await accountHandler(req("DELETE", "/api/account"), response);
    expect(response.statusCode).toBe(401);
    expect(db.deleteUser).not.toHaveBeenCalled();
  });

  it("revokes the account's sessions when signing out", async () => {
    const response = res();
    await signoutHandler(req("POST", "/api/auth/signout"), response);
    expect(response.statusCode).toBe(200);
    expect(db.revokeSessions).toHaveBeenCalledWith("user-1");
  });

  it("still signs out locally when the database cannot revoke", async () => {
    db.revokeSessions.mockRejectedValue(new Error("database down"));
    // The route logs this failure on purpose. Silence it so the expected
    // error does not read as a broken test run.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = res();
      await signoutHandler(req("POST", "/api/auth/signout"), response);
      expect(response.statusCode).toBe(200);
      expect(String(response.headers["set-cookie"])).toMatch(/roadready_session=;/);
    } finally {
      logged.mockRestore();
    }
  });

  it("still clears the cookie when the session cannot be read", async () => {
    // The route's contract: it can never leave someone signed in. Reading
    // the session can fail (a missing AUTH_SECRET); the cookie must still go.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = res();
      const request = req("POST", "/api/auth/signout");
      request.headers.cookie = "roadready_session=not-a-real-token";
      await signoutHandler(request, response);
      expect(String(response.headers["set-cookie"])).toMatch(/roadready_session=;/);
    } finally {
      logged.mockRestore();
    }
  });

  it("clears the cookie even when the deployment is misconfigured", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const previous = process.env.AUTH_URL;
    process.env.AUTH_URL = "not a url at all";
    try {
      const response = res();
      await signoutHandler(req("POST", "/api/auth/signout"), response);
      expect(String(response.headers["set-cookie"])).toMatch(/roadready_session=;/);
      // A broken configuration is reported as such, not as a CSRF refusal.
      expect(response.statusCode).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previous;
      logged.mockRestore();
    }
  });
});

describe("sync input bounds", () => {
  it("rejects an exponent-notation revision instead of letting it reach the database", async () => {
    const response = res();
    await syncHandler(req("PUT", "/api/sync", {
      payload: { bundle: "{}" }, expectedRevision: 1e300,
    }), response);
    expect(response.statusCode).toBe(400);
    expect(json(response).error).toMatch(/expectedRevision/);
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("rejects a revision with an absurd number of digits", async () => {
    const response = res();
    await syncHandler(req("PUT", "/api/sync", {
      payload: { bundle: "{}" }, expectedRevision: "9".repeat(40),
    }), response);
    expect(response.statusCode).toBe(400);
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("rejects a zero or negative revision", async () => {
    for (const bad of [0, -1]) {
      const response = res();
      await syncHandler(req("PUT", "/api/sync", {
        payload: { bundle: "{}" }, expectedRevision: bad,
      }), response);
      expect(response.statusCode).toBe(400);
    }
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("still accepts an ordinary revision", async () => {
    const response = res();
    await syncHandler(req("PUT", "/api/sync", {
      payload: { bundle: "{}" }, expectedRevision: "3",
    }), response);
    expect(response.statusCode).toBe(200);
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, "3");
  });

  it("serves metadata without the payload when asked for meta=1", async () => {
    const response = res();
    await syncHandler(req("GET", "/api/sync?meta=1"), response);
    expect(response.statusCode).toBe(200);
    expect(json(response).state.updated_at).toBe("2026-01-01T00:00:00Z");
    expect(json(response).state.payload).toBeUndefined();
    expect(db.readStateMeta).toHaveBeenCalledWith("user-1");
    expect(db.readState).not.toHaveBeenCalled();
  });

  it("does not treat a parameter that merely contains meta=1 as a metadata request", async () => {
    const response = res();
    await syncHandler(req("GET", "/api/sync?note=meta=1"), response);
    expect(response.statusCode).toBe(200);
    // The full snapshot is still returned; the shape did not silently change.
    expect(json(response).state.payload).toBeDefined();
    expect(db.readStateMeta).not.toHaveBeenCalled();
  });

  it("does not tell an unauthenticated caller which environment variables are missing", async () => {
    const response = res();
    const { default: syncWithNoDb } = { default: null };
    void syncWithNoDb;
    // Simulate the database not being configured by throwing its error type.
    const { DatabaseNotConfigured } = await import("../api/_lib/db.js");
    db.findUserById.mockRejectedValue(new DatabaseNotConfigured());
    await syncHandler(req("GET", "/api/sync"), response);
    expect(response.statusCode).toBe(503);
    expect(json(response).error).not.toMatch(/DATABASE_URL|AUTH_SECRET/);
  });

  it("reports a broken AUTH_URL as a configuration problem, not a CSRF refusal", async () => {
    const previous = process.env.AUTH_URL;
    process.env.AUTH_URL = "not a url at all";
    try {
      const response = res();
      await syncHandler(req("PUT", "/api/sync", {
        payload: { bundle: "{}" }, expectedRevision: null,
      }), response);
      // 403 would read to an operator like a CSRF attack. Nothing is written
      // either way, but the reason has to be the honest one.
      expect(response.statusCode).toBe(503);
      expect(json(response).error).toMatch(/not configured/i);
    } finally {
      if (previous === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previous;
    }
  });
});

describe("rate limiting", () => {
  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < 3; i++) expect(hit("k", 3).allowed).toBe(true);
    const blocked = hit("k", 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys separately per identity", () => {
    hit("a", 1);
    expect(hit("a", 1).allowed).toBe(false);
    expect(hit("b", 1).allowed).toBe(true);
  });

  it("never uses the raw address as the key", () => {
    const key = callerKey({ headers: { "x-forwarded-for": "203.0.113.9" }, socket: {} }, "a-secret");
    expect(key).not.toMatch(/203\.0\.113\.9/);
    expect(key).toHaveLength(32);
  });

  it("uses the right-most forwarded address, not the one a caller supplied", () => {
    // A caller that sends its own X-Forwarded-For can prepend a fresh
    // identity per request. The edge appends the real one, so the key must
    // be built from the right-most entry.
    const spoofed = callerKey({
      headers: { "x-forwarded-for": "198.51.100.7, 203.0.113.9" },
      socket: {},
    }, "a-secret");
    const genuine = callerKey({
      headers: { "x-forwarded-for": "203.0.113.9" },
      socket: {},
    }, "a-secret");
    expect(spoofed).toBe(genuine);
  });

  it("prefers the platform-set header over a caller-supplied one", () => {
    const platform = callerKey({
      headers: { "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.7" },
      socket: {},
    }, "a-secret");
    const genuine = callerKey({
      headers: { "x-vercel-forwarded-for": "203.0.113.9" },
      socket: {},
    }, "a-secret");
    expect(platform).toBe(genuine);
  });

  it("gives different callers different keys", () => {
    const a = callerKey({ headers: { "x-forwarded-for": "203.0.113.9" }, socket: {} }, "a-secret");
    const b = callerKey({ headers: { "x-forwarded-for": "203.0.113.10" }, socket: {} }, "a-secret");
    expect(a).not.toBe(b);
  });

  it("refuses a burst of sync writes with 429", async () => {
    let sawRateLimit = false;
    for (let i = 0; i < 40; i++) {
      const response = res();
      await syncHandler(req("PUT", "/api/sync", {
        payload: { bundle: "{}" }, expectedRevision: null,
      }), response);
      if (response.statusCode === 429) { sawRateLimit = true; break; }
    }
    expect(sawRateLimit).toBe(true);
  });
});

describe("google sign-in route", () => {
  afterEach(() => {
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.DATABASE_URL;
  });

  it("refuses a method other than GET", async () => {
    const response = res();
    await googleHandler(req("POST", "/api/auth/google"), response);
    expect(response.statusCode).toBe(405);
  });

  it("does not leak configuration details to the browser", async () => {
    const response = res();
    await googleHandler(req("GET", "/api/auth/google"), response);
    expect(response.statusCode).toBe(503);
    expect(json(response).error).not.toMatch(/DATABASE_URL|AUTH_SECRET|AUTH_GOOGLE/);
  });

  it("rate limits repeated sign-in starts", async () => {
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";
    process.env.DATABASE_URL = "postgres://localhost/db";
    let sawRateLimit = false;
    for (let i = 0; i < 30; i++) {
      const response = res();
      await googleHandler(req("GET", "/api/auth/google", null, { "x-forwarded-for": "198.51.100.7" }), response);
      if (response.statusCode === 429) { sawRateLimit = true; break; }
    }
    expect(sawRateLimit).toBe(true);
  });
});

describe("google callback route", () => {
  // The callback refuses to run unless the whole account stack is configured,
  // so these tests supply it: the point under test is the flow handling that
  // happens after that guard.
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://localhost/db";
    process.env.AUTH_GOOGLE_ID = "id";
    process.env.AUTH_GOOGLE_SECRET = "secret";
  });
  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
  });

  it("refuses a method other than GET", async () => {
    const response = res();
    await callbackHandler(req("POST", "/api/auth/callback"), response);
    expect(response.statusCode).toBe(405);
  });

  it("does not complete a flow whose state does not match", async () => {
    const flow = Buffer.from(JSON.stringify({ state: "real", verifier: "v", nonce: "n" })).toString("base64url");
    const response = res();
    await callbackHandler(req("GET", "/api/auth/callback?state=attacker&code=x", null, {
      cookie: `roadready_oauth_flow=${flow}`,
    }), response);
    expect(response.statusCode).toBe(302);
    expect(String(response.headers.location)).toMatch(/signin=failed/);
    expect(db.upsertGoogleUser).not.toHaveBeenCalled();
  });

  it("treats a declined consent screen as a normal outcome", async () => {
    const response = res();
    await callbackHandler(req("GET", "/api/auth/callback?error=access_denied"), response);
    expect(response.statusCode).toBe(302);
    expect(String(response.headers.location)).toMatch(/signin=cancelled/);
  });

  it("never lets a redirect be cached", async () => {
    const response = res();
    await callbackHandler(req("GET", "/api/auth/callback?error=access_denied"), response);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
