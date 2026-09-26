import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const db = vi.hoisted(() => ({
  findUserById: vi.fn(),
  readState: vi.fn(),
  writeState: vi.fn(),
  deleteState: vi.fn(),
  deleteUser: vi.fn(),
}));

const session = vi.hoisted(() => ({
  readSession: vi.fn(() => "user-1"),
  readCookies: vi.fn(() => ({ roadready_session: "token" })),
  clearSessionCookie: vi.fn(),
}));

vi.mock("../api/_lib/db.js", () => ({
  DatabaseNotConfigured: class DatabaseNotConfigured extends Error {},
  findUserById: db.findUserById,
  readState: db.readState,
  writeState: db.writeState,
  deleteState: db.deleteState,
  deleteUser: db.deleteUser,
}));

vi.mock("../api/_lib/session.js", () => ({
  MissingAuthSecret: class MissingAuthSecret extends Error {},
  SESSION_COOKIE: "roadready_session",
  readSession: session.readSession,
  readCookies: session.readCookies,
  clearSessionCookie: session.clearSessionCookie,
}));

const { default: syncHandler } = await import("../api/sync.js");
const { default: accountHandler } = await import("../api/account.js");

function response() {
  const headers = {};
  return {
    statusCode: 200,
    body: "",
    headers,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(body = "") { this.body = String(body); },
  };
}

function request(method, body, extraHeaders = {}) {
  const req = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = "/api/sync";
  req.headers = {
    host: "road.ready",
    origin: "https://road.ready",
    cookie: "roadready_session=token",
    // js/account.js always uploads as JSON; tests override when misbehaving.
    "content-type": "application/json",
    ...extraHeaders,
  };
  return req;
}

function jsonBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.readSession.mockReturnValue("user-1");
  session.readCookies.mockReturnValue({ roadready_session: "token" });
  db.findUserById.mockResolvedValue({ id: "user-1", email: "person@example.com" });
});

describe("sync API optimistic concurrency", () => {
  it("returns 409 when another device has advanced the revision", async () => {
    db.writeState.mockResolvedValue(null);
    db.readState.mockResolvedValue({ updated_at: "2026-09-26T12:00:00.000Z", revision: "8" });
    const res = response();

    await syncHandler(request("PUT", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: "7", force: false,
    }), res);

    expect(res.statusCode).toBe(409);
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, "7");
    expect(jsonBody(res)).toMatchObject({ revision: "8" });
  });

  it("returns the new revision after an atomic successful write", async () => {
    db.writeState.mockResolvedValue({ updated_at: "2026-09-26T12:01:00.000Z", revision: "8" });
    const res = response();

    await syncHandler(request("PUT", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: "7", force: false,
    }), res);

    expect(res.statusCode).toBe(200);
    expect(jsonBody(res)).toMatchObject({ revision: "8" });
  });

  it("requires the client to state which remote revision it observed", async () => {
    const res = response();
    await syncHandler(request("PUT", { payload: { bundle: "{}" }, version: 1 }), res);
    expect(res.statusCode).toBe(400);
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("never exposes an unconditional overwrite path", async () => {
    db.writeState.mockResolvedValue(null);
    db.readState.mockResolvedValue({ updated_at: "2026-09-26T12:02:00.000Z", revision: "9" });
    const res = response();
    await syncHandler(request("PUT", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: "2", force: true,
    }), res);
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, "2");
    expect(res.statusCode).toBe(409);
  });

  it("rejects non-JSON uploads before buffering them", async () => {
    const req = request("PUT", { payload: { bundle: "{}" }, version: 1, expectedRevision: null });
    req.headers["content-type"] = "text/plain";
    const res = response();
    await syncHandler(req, res);
    expect(res.statusCode).toBe(415);
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("accepts a null expectedRevision for a first save against an empty account", async () => {
    db.writeState.mockResolvedValue({ updated_at: "2026-09-26T12:05:00.000Z", revision: "1" });
    const res = response();
    await syncHandler(request("PUT", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: null,
    }), res);
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, null);
    expect(res.statusCode).toBe(200);
  });

  it("refuses malformed revision tokens instead of coercing them", async () => {
    const res = response();
    await syncHandler(request("PUT", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: "007-or-junk",
    }), res);
    expect(res.statusCode).toBe(400);
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("answers GET with the stored snapshot for the signed-in user", async () => {
    db.readState.mockResolvedValue({
      payload: { bundle: "{\"v\":1}" }, updated_at: "2026-09-26T12:00:00.000Z", version: 1, revision: "3",
    });
    const res = response();
    await syncHandler(request("GET", null), res);
    expect(res.statusCode).toBe(200);
    expect(jsonBody(res).state.revision).toBe("3");
  });

  it("degrades to 503 when the database is not configured", async () => {
    const { DatabaseNotConfigured } = await import("../api/_lib/db.js");
    db.findUserById.mockRejectedValue(new DatabaseNotConfigured());
    const res = response();
    await syncHandler(request("GET", null), res);
    expect(res.statusCode).toBe(503);
  });

  it("rejects unexpected HTTP methods", async () => {
    const res = response();
    await syncHandler(request("PATCH", { payload: { bundle: "{}" } }), res);
    expect(res.statusCode).toBe(405);
  });
});

describe("account deletion API", () => {
  it("deletes the server account and clears the session while leaving local data to the client", async () => {
    const req = request("DELETE", null);
    req.url = "/api/account";
    const res = response();

    await accountHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(db.deleteUser).toHaveBeenCalledWith("user-1");
    expect(session.clearSessionCookie).toHaveBeenCalledWith(res);
  });

  it("refuses cross-origin deletion", async () => {
    const req = request("DELETE", null, { origin: "https://evil.example" });
    req.url = "/api/account";
    const res = response();

    await accountHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(db.deleteUser).not.toHaveBeenCalled();
  });
});
