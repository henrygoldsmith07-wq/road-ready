import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("../js/account-ui.js", import.meta.url)), "utf8");

function harness(account, confirmImpl = () => true) {
  const dom = new JSDOM('<div id="accountPanel" hidden><span id="accountActions"></span><p id="accountNote"></p></div>');
  new Function("window", "document", "confirm", SRC)(dom.window, dom.window.document, confirmImpl);
  return {
    ui: dom.window.RoadReadyAccountUI,
    actions: () => dom.window.document.getElementById("accountActions"),
    note: () => dom.window.document.getElementById("accountNote").textContent,
    panel: () => dom.window.document.getElementById("accountPanel"),
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function baseAccount(overrides = {}) {
  return {
    consumeSignInOutcome: vi.fn(() => null),
    fetchAccount: vi.fn(async () => ({ available: true, user: null })),
    remoteMeta: vi.fn(async () => ({ updatedAt: null, revision: null })),
    startGoogleSignIn: vi.fn(),
    signOut: vi.fn(async () => {}),
    push: vi.fn(async () => ({ status: "ok", updatedAt: null, revision: "1" })),
    pull: vi.fn(async () => ({ status: "empty" })),
    deleteRemote: vi.fn(async () => ({ status: "empty" })),
    deleteAccount: vi.fn(async () => ({ status: "ok" })),
    ...overrides,
  };
}

describe("account UI controller", () => {
  it("keeps account controls optional when signed out", async () => {
    const account = baseAccount();
    const h = harness(account);
    await h.ui.init({ account, getBundle: () => "bundle", parseBundle: vi.fn(), applyState: vi.fn() });
    expect(h.panel().hidden).toBe(false);
    expect(h.actions().textContent).toContain("Sign in with Google");
    expect(h.note()).toContain("fully offline");
  });

  it("uses the observed revision and force-overwrites only after confirmation", async () => {
    const push = vi.fn()
      .mockResolvedValueOnce({ status: "conflict", remoteUpdatedAt: "2026-09-26T12:00:00Z", remoteRevision: "8" })
      .mockResolvedValueOnce({ status: "ok", updatedAt: "2026-09-26T12:01:00Z", revision: "9" });
    const account = baseAccount({
      fetchAccount: vi.fn(async () => ({ available: true, user: { email: "person@example.com" } })),
      remoteMeta: vi.fn(async () => ({ updatedAt: "2026-09-26T11:59:00Z", revision: "7" })),
      push,
    });
    const h = harness(account, () => true);
    await h.ui.init({ account, getBundle: () => "bundle-v1", parseBundle: vi.fn(), applyState: vi.fn() });
    [...h.actions().querySelectorAll("button")].find((b) => b.textContent === "Save").click();
    await tick(); await tick();
    expect(push).toHaveBeenNthCalledWith(1, "bundle-v1", "7", false);
    expect(push).toHaveBeenNthCalledWith(2, "bundle-v1", "7", true);
    expect(h.note()).toBe("Saved to your account.");
  });

  it("deletes the remote account without applying new local state", async () => {
    const applyState = vi.fn();
    const account = baseAccount({
      fetchAccount: vi.fn(async () => ({ available: true, user: { email: "person@example.com" } })),
      remoteMeta: vi.fn(async () => ({ updatedAt: null, revision: null })),
    });
    const h = harness(account, () => true);
    await h.ui.init({ account, getBundle: () => "bundle", parseBundle: vi.fn(), applyState });
    [...h.actions().querySelectorAll("button")].find((b) => b.textContent === "Delete account & cloud data").click();
    await tick();
    expect(account.deleteAccount).toHaveBeenCalledOnce();
    expect(applyState).not.toHaveBeenCalled();
    expect(h.actions().textContent).toContain("Sign in with Google");
    expect(h.note()).toContain("local progress is still on this device");
  });
});
