/* Road Ready — Google account and cross-device sync.
 *
 * A plain global script like the rest of this app: no build step, no modules.
 *
 * Sync carries exactly the backup bundle that Export/Import already produces
 * (Core.exportBundle / Core.parseImport). Signing in does not introduce a
 * second notion of "all my progress" — it stores that same bundle, so there is
 * one format and one restore path to keep correct rather than two that drift.
 *
 * The whole feature is inert unless a deployment configures it. Opening
 * index.html straight from disk, as the README describes, hits no API at all
 * and the account panel never appears.
 */
"use strict";

(function () {
  const SIGNED_OUT = { available: false, user: null };

  /** Who is signed in, and whether sign-in exists on this deployment at all. */
  async function fetchAccount() {
    try {
      const response = await fetch("/api/auth/session", { headers: { accept: "application/json" } });
      if (!response.ok) return SIGNED_OUT;
      const body = await response.json();
      return { available: Boolean(body.available), user: body.user || null };
    } catch {
      // file:// or a plain static host has no API routes. "No accounts" is the
      // right answer there, not a broken screen.
      return SIGNED_OUT;
    }
  }

  function startGoogleSignIn() {
    // A full navigation: the consent screen is Google's page, not ours.
    window.location.href = "/api/auth/google";
  }

  async function signOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      /* signing out must never fail loudly */
    }
  }

  async function remoteUpdatedAt() {
    const response = await fetch("/api/sync", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const body = await response.json();
    return (body.state && body.state.updated_at) || null;
  }

  /**
   * Uploads `bundleText` (the JSON string Core.exportBundle returns).
   *
   * `expected` is the timestamp the caller believes is on the server; when the
   * server has moved on the push is refused as a conflict rather than
   * overwriting a copy this device has never seen. `force` overwrites after
   * the user has been asked.
   */
  async function push(bundleText, expected, force) {
    if (!force) {
      const actual = await remoteUpdatedAt();
      if (actual !== expected) return { status: "conflict", remoteUpdatedAt: actual };
    }
    const response = await fetch("/api/sync", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: { bundle: bundleText }, version: 1 }),
    });
    if (response.status === 401) return { status: "signed-out" };
    if (response.status === 503) {
      return { status: "unavailable", message: "Sync is not configured for this deployment." };
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { status: "error", message: body.error || "Sync failed (" + response.status + ")" };
    }
    const body = await response.json();
    return { status: "ok", updatedAt: body.updated_at };
  }

  /** Downloads this account's bundle as text, for Core.parseImport to validate. */
  async function pull() {
    const response = await fetch("/api/sync", { headers: { accept: "application/json" } });
    if (response.status === 401) return { status: "signed-out" };
    if (response.status === 503) {
      return { status: "unavailable", message: "Sync is not configured for this deployment." };
    }
    if (!response.ok) return { status: "error", message: "Sync failed (" + response.status + ")" };
    const body = await response.json();
    if (!body.state || !body.state.payload || typeof body.state.payload.bundle !== "string") {
      return { status: "empty" };
    }
    return { status: "ok", bundle: body.state.payload.bundle, updatedAt: body.state.updated_at };
  }

  /** Removes the account's copy. This device keeps its progress. */
  async function deleteRemote() {
    const response = await fetch("/api/sync", { method: "DELETE" });
    if (!response.ok) return { status: "error", message: "Delete failed (" + response.status + ")" };
    return { status: "empty" };
  }

  /**
   * Reads and clears the ?signin=… the OAuth callback returns with, so a
   * refresh does not repeat the message.
   */
  function consumeSignInOutcome() {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("signin");
    if (!outcome) return null;
    params.delete("signin");
    params.delete("reason");
    const query = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? "?" + query : ""));
    if (outcome === "ok") return "Signed in.";
    if (outcome === "cancelled") return "Sign-in cancelled.";
    return "Sign-in failed. Please try again.";
  }

  window.RoadReadyAccount = {
    fetchAccount,
    startGoogleSignIn,
    signOut,
    remoteUpdatedAt,
    push,
    pull,
    deleteRemote,
    consumeSignInOutcome,
  };
})();
