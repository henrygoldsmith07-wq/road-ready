import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

process.env.AUTH_SECRET = "integration-test-secret";
process.env.AUTH_GOOGLE_ID = "test-client.apps.googleusercontent.com";
process.env.AUTH_GOOGLE_SECRET = "test-google-secret";
process.env.DATABASE_URL = "postgres://integration.invalid/db";
process.env.NODE_ENV = "test";

const db = vi.hoisted(() => ({
  findUserById: vi.fn(),
  readState: vi.fn(),
  writeState: vi.fn(),
  deleteState: vi.fn(),
}));

vi.mock("../api/_lib/db.js", () => ({
  DatabaseNotConfigured: class DatabaseNotConfigured extends Error {},
  findUserById: db.findUserById,
  readState: db.readState,
  writeState: db.writeState,
  deleteState: db.deleteState,
}));

const { issueSession, SESSION_COOKIE } = await import("../api/_lib/session.js");
const { default: sessionHandler } = await import("../api/auth/session.js");
const { default: signoutHandler } = await import("../api/auth/signout.js");
const { default: syncHandler } = await import("../api/sync.js");

function res() {
  const headers = {};
  return {
    statusCode: 200,
    body: "",
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(body = "") { this.body = String(body); },
  };
}

function req(method, path, body, origin = "https://road.ready") {
  const stream = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.url = path;
  stream.headers = {
    host: "road.ready",
    origin,
    cookie: `${SESSION_COOKIE}=${issueSession("user-1")}`,
    // The real client (js/account.js) uploads JSON; sync enforces it.
    "content-type": body == null ? "" : "application/json",
  };
  return stream;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.findUserById.mockResolvedValue({ id: "user-1", email: "person@example.com", name: "Person", image: null });
});

describe("backend route integration", () => {
  it("resolves a real signed session through the account route", async () => {
    const response = res();
    await sessionHandler(req("GET", "/api/auth/session"), response);
    expect(JSON.parse(response.body)).toMatchObject({ available: true, user: { id: "user-1", email: "person@example.com" } });
  });

  it("rejects the wrong session endpoint method", async () => {
    const response = res();
    await sessionHandler(req("POST", "/api/auth/session"), response);
    expect(response.statusCode).toBe(405);
  });

  it("passes the authenticated user and expected revision into sync", async () => {
    db.writeState.mockResolvedValue({ updated_at: "2026-09-26T14:00:00Z", revision: "4" });
    const response = res();
    await syncHandler(req("PUT", "/api/sync", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: "3",
    }), response);
    expect(response.statusCode).toBe(200);
    expect(db.writeState).toHaveBeenCalledWith("user-1", { bundle: "{}" }, 1, "3");
  });

  it("rejects a foreign Origin even with a valid signed session", async () => {
    const response = res();
    await syncHandler(req("PUT", "/api/sync", {
      payload: { bundle: "{}" }, version: 1, expectedRevision: null,
    }, "https://evil.example"), response);
    expect(response.statusCode).toBe(403);
    expect(db.writeState).not.toHaveBeenCalled();
  });

  it("refuses cross-origin sign-out requests", () => {
    const response = res();
    signoutHandler(req("POST", "/api/auth/signout", null, "https://evil.example"), response);
    expect(response.statusCode).toBe(403);
  });
});
