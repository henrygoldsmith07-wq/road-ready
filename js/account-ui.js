/* Road Ready — account/sync settings controller.
 *
 * Keeps account lifecycle and conflict UX out of app.js. The controller knows
 * nothing about Road Ready's state shape: callers provide bundle/parse/apply
 * callbacks, so the network client and the application state remain separate.
 */
"use strict";

(function () {
  async function init({ account, getBundle, parseBundle, applyState }) {
    if (!account) return;

    let accountState = { available: false, user: null };
    let remoteAt = null;
    let remoteRevision = null;

    const noteEl = () => document.getElementById("accountNote");
    const setNote = (text) => { const el = noteEl(); if (el) el.textContent = text || ""; };

    function button(label, onClick) {
      const el = document.createElement("button");
      el.className = "btn ghost";
      el.textContent = label;
      el.addEventListener("click", onClick);
      return el;
    }

    async function upload(force) {
      setNote("Saving…");
      const result = await account.push(getBundle(), remoteRevision, force);
      if (result.status === "ok") {
        remoteAt = result.updatedAt;
        remoteRevision = result.revision || remoteRevision;
        render();
        setNote("Saved to your account.");
        return;
      }
      if (result.status === "conflict") {
        const when = result.remoteUpdatedAt ? new Date(result.remoteUpdatedAt).toLocaleString() : "unknown";
        if (confirm("Another device saved at " + when + ". Overwrite it with this device's progress?")) {
          await upload(true);
          return;
        }
        setNote("Left the other device's copy alone.");
        return;
      }
      setNote(result.message || "Sync failed.");
    }

    async function restore() {
      setNote("Fetching…");
      const result = await account.pull();
      if (result.status === "empty") { setNote("Nothing has been saved to this account yet."); return; }
      if (result.status !== "ok") { setNote(result.message || "Sync failed."); return; }

      const parsed = parseBundle(result.bundle);
      if (!parsed.ok) { setNote("That saved copy could not be read (" + parsed.error + ")."); return; }
      if (!confirm(parsed.warnings.length
        ? "The saved copy is from another app version (" + parsed.warnings.join(", ") + "). Restore anyway?"
        : "Replace current progress with the copy from your account?")) return;

      applyState(parsed.state);
      remoteAt = result.updatedAt;
      remoteRevision = result.revision || null;
      render();
      setNote("Restored from your account.");
    }

    function render() {
      const panel = document.getElementById("accountPanel");
      const actions = document.getElementById("accountActions");
      if (!panel || !actions) return;
      panel.hidden = !accountState.available;
      if (!accountState.available) return;

      actions.textContent = "";
      if (!accountState.user) {
        actions.appendChild(button("Sign in with Google", () => account.startGoogleSignIn()));
        setNote("Optional — Road Ready works fully offline without an account.");
        return;
      }

      actions.appendChild(button("Save", () => upload(false)));
      actions.appendChild(button("Restore", restore));
      actions.appendChild(button("Sign out", async () => {
        await account.signOut();
        accountState = { available: true, user: null };
        remoteAt = null;
        remoteRevision = null;
        render();
        setNote("Signed out. Your progress stays on this device.");
      }));
      actions.appendChild(button("Delete copy", async () => {
        if (!confirm("Delete the copy stored in your account? This device keeps its progress.")) return;
        const result = await account.deleteRemote();
        if (result.status !== "empty") {
          setNote(result.message || "Could not delete the cloud copy.");
          return;
        }
        remoteAt = null;
        remoteRevision = null;
        setNote("Removed the copy from your account.");
      }));
      actions.appendChild(button("Delete account & cloud data", async () => {
        if (!confirm("Delete your Road Ready account and its cloud copy? Your progress on this device will stay here. This cannot be undone.")) return;
        const result = await account.deleteAccount();
        if (result.status !== "ok") {
          setNote(result.message || "Could not delete the account.");
          return;
        }
        accountState = { available: true, user: null };
        remoteAt = null;
        remoteRevision = null;
        render();
        setNote("Account and cloud data deleted. Your local progress is still on this device.");
      }));

      setNote("Signed in as " + accountState.user.email
        + (remoteAt ? " — last saved " + new Date(remoteAt).toLocaleDateString() : " — nothing saved yet") + ".");
    }

    const outcome = account.consumeSignInOutcome();
    accountState = await account.fetchAccount();
    if (accountState.user) {
      const meta = await account.remoteMeta().catch(() => ({ updatedAt: null, revision: null }));
      remoteAt = meta.updatedAt;
      remoteRevision = meta.revision;
    }
    render();
    if (outcome) setNote(outcome);
  }

  window.RoadReadyAccountUI = { init };
})();
