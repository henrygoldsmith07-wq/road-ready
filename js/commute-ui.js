/* Road Ready — Commute Mode (hands-free audio review).
 *
 * Weakest-rules-first playlist read aloud via speechSynthesis. Exposure only:
 * listening never writes mastery, XP or streaks — the UI says so, and the
 * module has no write path to state. Works offline with on-device voices;
 * nothing is uploaded or stored.
 *
 * Classic-script module: dependencies arrive via RoadReadyCommuteUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;
  let list = [];
  let idx = 0;
  let playing = false;
  let autoplay = true;
  let bound = false;

  /** @returns {any} element by id */
  function $(id) { return document.getElementById(id); }

  function ttsOk() {
    try {
      return typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
    } catch { return false; }
  }

  function stopSpeech() {
    try { if (ttsOk()) speechSynthesis.cancel(); } catch { /* ignore */ }
    if (playing) {
      playing = false;
      paintControls();
    } else {
      paintControls();
    }
    try {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
    } catch { /* lock-screen controls are a courtesy */ }
  }

  /* Lock-screen / headset controls: Commute is hands-free, so the OS play /
   * pause / next / previous buttons should drive the playlist. Everything is
   * guarded — browsers without Media Session keep the on-screen buttons. */
  function syncMedia(q) {
    try {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      if (typeof window === "undefined" || typeof window.MediaMetadata !== "function") return;
      navigator.mediaSession.metadata = q
        ? new window.MediaMetadata({
          title: `Rule ${idx + 1} of ${list.length}`,
          artist: "Road Ready Commute",
          album: q.q.length > 80 ? q.q.slice(0, 80) + "…" : q.q,
        })
        : null;
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch { /* never break audio for metadata */ }
  }

  function bindMediaActions() {
    try {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      const ms = navigator.mediaSession;
      if (typeof ms.setActionHandler !== "function") return;
      ms.setActionHandler("play", () => { if (!playing) playAt(idx); });
      ms.setActionHandler("pause", () => { if (playing) stopSpeech(); });
      ms.setActionHandler("previoustrack", () => playAt(idx - 1));
      ms.setActionHandler("nexttrack", () => playAt(idx + 1));
    } catch { /* ignore — on-screen controls remain */ }
  }

  function speakLine(text, onend) {
    if (!ttsOk() || !text) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      if (onend) {
        u.onend = onend;
        // Some browsers never fire onend after cancel/pause; guard against a
        // stuck "Pause" label by resetting when speech actually ends.
        u.onerror = () => { playing = false; paintControls(); };
      }
      speechSynthesis.speak(u);
      return true;
    } catch { return false; }
  }

  function playAt(i) {
    if (!ctx) return;
    const bank = ctx.getBank();
    if (!list.length) return;
    idx = Math.max(0, Math.min(list.length - 1, i));
    savePos();
    const byId = {};
    bank.forEach((q) => { byId[q.id] = q; });
    const q = byId[list[idx]];
    if (!q) return;
    playing = true;
    paintControls();
    paintList();
    syncMedia(q);
    bindMediaActions();
    const line = ctx.Core.commuteLine(q);
    const ok = speakLine(line, () => {
      if (autoplay && idx + 1 < list.length && playing) playAt(idx + 1);
      else { playing = false; paintControls(); paintList(); }
    });
    if (!ok) { playing = false; paintControls(); }
  }

  function paintControls() {
    const play = $("coPlay");
    const pos = $("coPos");
    if (play) {
      play.textContent = playing ? "Pause" : (idx > 0 ? "Resume" : "Play weakest 10");
      play.disabled = !list.length || !ttsOk();
    }
    if (pos) pos.textContent = list.length ? `${Math.min(idx + 1, list.length)}/${list.length}` : "0/0";
    const prev = $("coPrev");
    const next = $("coNext");
    if (prev) prev.disabled = !list.length;
    if (next) next.disabled = !list.length;
    const auto = $("coAuto");
    if (auto) {
      auto.setAttribute("aria-pressed", autoplay ? "true" : "false");
      auto.textContent = autoplay ? "Autoplay on" : "Autoplay off";
    }
    const stop = $("coStop");
    if (stop) stop.disabled = !playing && !ttsOk();
    const note = $("coSupport");
    if (note) note.hidden = ttsOk();
  }

  function paintList() {
    const host = $("coList");
    if (!host) return;
    const bank = ctx.getBank();
    const byId = {};
    bank.forEach((q) => { byId[q.id] = q; });
    host.replaceChildren();
    list.forEach((id, i) => {
      const q = byId[id];
      if (!q) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "card commute-item" + (i === idx ? " active" : "");
      if (i === idx && playing) b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Play rule ${i + 1} of ${list.length}: ${q.q}`);
      const t = document.createElement("div");
      t.className = "ri-q";
      t.textContent = `${i + 1}. ${q.q}`;
      const a = document.createElement("div");
      a.className = "ri-why";
      a.textContent = q.why || "";
      b.append(t, a);
      b.addEventListener("click", () => playAt(i));
      host.appendChild(b);
    });
  }

  /* Listening position lives in sessionStorage (per tab, non-learning): a
   * learner who hops to Quiz to check a rule and comes straight back should
   * not have to find their place again. Never written to the progress state,
   * which stays untouched by listening. */
  const POS_KEY = "roadready.commute.pos";
  function savePos() {
    try {
      if (typeof sessionStorage === "undefined") return;
      sessionStorage.setItem(POS_KEY, JSON.stringify({ ids: list, idx }));
    } catch { /* position memory is a courtesy */ }
  }
  function storedPos() {
    try {
      if (typeof sessionStorage === "undefined") return null;
      const raw = sessionStorage.getItem(POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p && Array.isArray(p.ids) && typeof p.idx === "number" ? p : null;
    } catch { return null; }
  }

  function rebuild() {
    const bank = ctx.getBank();
    const state = ctx.getState();
    const next = ctx.Core.buildCommuteQueue(bank, state.qstats, 10);
    // Preserve position when the queue is unchanged (e.g. re-render after a
    // bank refresh) instead of jumping back to the top mid-playlist.
    const same = next.length === list.length && next.every((id, i) => id === list[i]);
    list = next;
    if (!same) {
      const saved = storedPos();
      const matchesSaved = saved && saved.ids.length === list.length && saved.ids.every((id, i) => id === list[i]);
      idx = matchesSaved ? saved.idx : 0;
    }
    idx = list.length ? Math.max(0, Math.min(idx, list.length - 1)) : 0;
    if (!list.length) playing = false;
    else if (playing && !ttsOk()) playing = false;
    else if (playing) {
      try {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) playing = false;
      } catch { /* ignore — keep flag */ }
    }
  }

  function render() {
    if (!ctx) return;
    rebuild();
    paintControls();
    paintList();
    const sub = $("coSub");
    if (sub) {
      const n = list.length;
      sub.textContent = n
        ? `Your ${n} weakest rules, read aloud hands-free. Listening doesn't change mastery — answer in Practice to lock it in.`
        : "Answer a few questions first — Commute Mode plays your weakest rules back.";
    }
  }

  function init(deps) {
    ctx = deps;
    if (bound) { render(); return; }
    bound = true;
    const play = $("coPlay");
    if (play) play.addEventListener("click", () => {
      if (playing) { stopSpeech(); return; }
      if (!list.length) rebuild();
      playAt(idx);
    });
    const next = $("coNext");
    if (next) next.addEventListener("click", () => playAt(idx + 1));
    const prev = $("coPrev");
    if (prev) prev.addEventListener("click", () => playAt(idx - 1));
    const auto = $("coAuto");
    if (auto) auto.addEventListener("click", () => { autoplay = !autoplay; paintControls(); });
    const stop = $("coStop");
    if (stop) stop.addEventListener("click", stopSpeech);
    document.addEventListener("visibilitychange", () => {
      if (!playing) return;
      try {
        if (!ttsOk()) return;
        if (document.hidden) speechSynthesis.pause();
        else speechSynthesis.resume();
      } catch { /* ignore */ }
    });
  }

  /** Keyboard/hands-free affordances: same actions as the on-screen buttons. */
  function toggle() {
    if (!ctx) return;
    if (playing) { stopSpeech(); return; }
    if (!list.length) rebuild();
    playAt(idx);
  }
  function next() { if (ctx && list.length) playAt(idx + 1); }
  function prev() { if (ctx && list.length) playAt(idx - 1); }

  const api = { init, render, stop: stopSpeech, toggle, next, prev };
  if (typeof window !== "undefined") window.RoadReadyCommuteUI = api;
})();
