/* Road Ready — sign flashcard UI.
 *
 * Extracted from app.js: the flashcard deck (rendering, flip/navigation,
 * self-grading) and the jurisdiction-aware sign copy helpers used by the
 * question cards and review list. The spaced-review schedule (new / learning /
 * familiar / mastered / due) lives in js/core.js — this file renders the
 * states and records self-grades only.
 *
 * Classic-script module: dependencies arrive via RoadReadyFlashcardsUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;
  let fcIndex = 0;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }

  /* Sign ARTWORK is shared across jurisdictions, but the WORDING attached to a
   * sign is not: GB says level crossing and 1.5 m when passing a cyclist, where
   * the US text says railroad and 3 feet. A sign that appears in more than one
   * jurisdiction's bank carries a per-jurisdiction variant under `alt`, which
   * wins. */
  function signCopy(id) {
    const { SIGNS, getState } = ctx;
    const s = SIGNS[id];
    if (!s) return { name: "", meaning: "" };
    const alt = s.alt && s.alt[getState().settings.statePack];
    return alt ? { name: alt.name || s.name, meaning: alt.meaning || s.meaning } : s;
  }

  function signArt(id, size) {
    return ctx.signSVG(id, size, signCopy(id).name);
  }

  function fcIds() {
    /* Deck is scoped to the signs this jurisdiction's questions actually use,
       so a GB learner is never drilled on US-only artwork (and vice versa).
       Falls back to the full library only if the bank references no signs. */
    const { Core, SIGNS, getBank, getState } = ctx;
    const state = getState();
    const used = Core.signIdsInBank(getBank()).filter((id) => SIGNS[id]);
    const ids = used.length ? used : Object.keys(SIGNS);
    if (state.fcOrder && state.fcOrder.length === ids.length &&
        state.fcOrder.every((id) => ids.includes(id))) return state.fcOrder;
    return ids;
  }

  function render() {
    const { Core, getState, icon } = ctx;
    const state = getState();
    const ids = fcIds();
    if (!ids.length) return;
    fcIndex = Math.min(fcIndex, ids.length - 1);
    const id = ids[fcIndex];
    const copy = signCopy(id);
    $("fcSign").innerHTML = signArt(id, 200);
    $("fcName").textContent = copy.name;
    $("fcMeaning").textContent = copy.meaning;
    $("fcCounter").textContent = `${fcIndex + 1} / ${ids.length}`;
    const scope = $("fcScope");
    if (scope) {
      const t = ctx.termsForPack();
      scope.textContent = `${ids.length} signs used in your ${t.regionLabel} pack \u2014 cards for signs that appear in that jurisdiction's questions, not the whole shared library.`;
    }
    // Spaced review states: new / learning / familiar / mastered / due — a card
    // schedule, not a binary known bit. fcKnown stays in sync for the legacy
    // "all signs known" achievement.
    const counts = Core.signStageCounts(ids, state.signStudy);
    const stage = Core.signStage(state.signStudy[id], Date.now());
    $("fcKnownPill").innerHTML = `${icon("check", 13)} ${counts.mastered}/${ids.length} mastered · ${counts.due} due`;
    const card = $("flashcard");
    card.classList.remove("flipped");
    card.classList.toggle("known", stage === "mastered");
    const stagePill = $("fcStage");
    if (stagePill) {
      const STAGE_LABELS = {
        new: "New", learning: "Learning", familiar: "Familiar", mastered: "Mastered", due: "Due for review",
      };
      stagePill.textContent = STAGE_LABELS[stage] || "New";
      stagePill.dataset.stage = stage;
      stagePill.hidden = false;
    }
    $("btnFcYes").innerHTML = `${icon("check", 16)} ${stage === "new" ? "I Know It" : stage === "due" ? "Still Got It" : "I Know It"}`;
  }

  function flipCard() { $("flashcard").classList.toggle("flipped"); }

  function fcMove(d) {
    const ids = fcIds();
    fcIndex = (fcIndex + d + ids.length) % ids.length;
    render();
  }

  function fcMark(known) {
    const { Core, getState, save, unlock } = ctx;
    const state = getState();
    const ids = fcIds();
    const id = ids[fcIndex];
    const now = Date.now();
    state.signStudy[id] = Core.reviewSign(state.signStudy[id], known, now);
    // legacy flag mirrors the spaced state for the "all signs known" achievement
    if (state.signStudy[id].stage === "mastered") state.fcKnown[id] = true;
    else delete state.fcKnown[id];
    save();
    if (ids.every((s) => state.fcKnown[s])) unlock("signs");
    fcMove(1);
  }

  function shuffleDeck() {
    const { Core, getState, save } = ctx;
    const state = getState();
    state.fcOrder = Core.shuffle(fcIds());
    fcIndex = 0;
    save();
    render();
  }

  function resetDeck() {
    const { getState, save } = ctx;
    if (!confirm("Reset all 'known' marks?")) return;
    const state = getState();
    state.fcKnown = {};
    state.signStudy = {};
    state.fcOrder = null;
    save();
    render();
  }

  window.RoadReadyFlashcardsUI = {
    /** @param {{Core, SIGNS, signSVG, icon, getState, save, getBank, unlock, termsForPack}} deps */
    init(deps) { ctx = deps; },
    render, flipCard, fcMove, fcMark, shuffleDeck, resetDeck,
    signCopy, signArt, fcIds,
  };
})();
