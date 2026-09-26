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
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, "7", false);
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

  it("allows a force overwrite only when the client explicitly sends force", async () => {
    db.writeState.mockResolvedValue({ updated_at: "2026-09-26T12:02:00.000Z", revision: "9" });
    const res = response();
    await syncHandler(request("PUT", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: "2", force: true,
    }), res);
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, "2", true);
    expect(res.statusCode).toBe(200);
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
