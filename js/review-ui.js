/* Road Ready — Review Missed (weakness management) UI.
 *
 * Extracted from app.js: the weakness-grouped Review screen and the answer-
 * fluency panel on Progress. The grouping/prioritisation logic lives in
 * js/coach.js (Coach.reviewGroups) and the fluency classification in
 * js/core.js — this file renders and wires only.
 *
 * Classic-script module: dependencies arrive via RoadReadyReviewUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;
  // Whether snoozed problems are currently shown. Session-local on purpose:
  // the default view is the work that matters now, snoozes one tap away.
  let showSnoozed = false;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); }

  /**
   * Not an analytics dump: mistakes are grouped into a short, prioritised list
   * (misconception patterns first, then persistent/recent errors, fast-wrong,
   * slow-right, overdue review), each with a one-line "why" and a one-tap drill.
   * The summary line answers the key question: how many underlying concepts the
   * misses actually map to.
   */
  function render() {
    const { Coach, Core, getState, getBank, getQuestion, icon, escapeHTML, sourceCitationHTML, signArt, startPractice, shuffle } = ctx;
    const state = getState();
    const bank = getBank();
    if (!state.reviewSnoozed || typeof state.reviewSnoozed !== "object" || Array.isArray(state.reviewSnoozed)) {
      state.reviewSnoozed = {};
    }
    const wc = Coach.weaknessCentre({
      bank,
      qstats: state.qstats,
      misconceptions: state.misconceptions,
      nowMs: Date.now(),
      snoozed: state.reviewSnoozed,
    });
    // Prune snoozes that no longer match a live problem (the weakness was
    // repaired, so the deferral is spent) or that expired. A snooze defers
    // work for up to 30 days — it is never a permanent dismissal.
    {
      const live = new Set();
      wc.sections.forEach((s) => s.problems.forEach((p) => live.add(Coach.snoozeKey(p.category, p.key))));
      const SNOOZE_TTL_MS = 30 * 86400000;
      let pruned = false;
      for (const k of Object.keys(state.reviewSnoozed)) {
        const ts = state.reviewSnoozed[k];
        if (!live.has(k) || typeof ts !== "number" || Date.now() - ts > SNOOZE_TTL_MS) {
          delete state.reviewSnoozed[k];
          pruned = true;
        }
      }
      if (pruned) ctx.save();
    }
    const visibleSections = wc.sections
      .map((s) => ({ ...s, problems: s.problems.filter((p) => showSnoozed || !p.snoozed) }))
      .filter((s) => s.problems.length);
    const hiddenSnoozed = showSnoozed ? 0 : wc.snoozedCount;
    const sub = $("reviewSub");
    const summary = $("reviewSummary");
    const host = $("reviewGroups");
    const list = $("reviewList");
    if (!host) return;

    // Shared tail: the full missed list stays as deep detail under the groups,
    // in every non-empty state (including all-snoozed).
    function renderMissedTail() {
      const missed = Core.missedQuestions(bank, state.qstats);
      list.innerHTML = missed.length
        ? `<details class="review-details"><summary>All ${missed.length} missed question${missed.length === 1 ? "" : "s"}</summary>` +
          missed.map((q) => {
            return `<div class="review-item card">
              ${q.signId ? `<div class="sign-frame small">${signArt(q.signId, 70)}</div>` : ""}
              <div>
                <div class="ri-q">${escapeHTML(q.q)}</div>
                 <div class="ri-a ok">${icon("check", 14)} ${escapeHTML(q.choices[q.a])}</div>
                 <div class="ri-why">${escapeHTML(q.why)}</div>
                 ${sourceCitationHTML(q)}
               </div></div>`;
          }).join("") + "</details>"
        : "";
      const drillBtn = $("btnDrillMissed");
      if (drillBtn) {
        drillBtn.style.display = missed.length ? "" : "none";
        drillBtn.innerHTML = `${icon("target", 15)} Drill All Missed Questions`;
      }
    }

    if (!wc.sections.length) {
      sub.textContent = "Nothing to repair yet.";
      if (summary) summary.hidden = true;
      host.innerHTML = "";
      list.innerHTML = `<p class="muted">No weaknesses — keep practising and anything that slips will gather here.</p>`;
      $("btnDrillMissed").style.display = "none";
      return;
    }
    if (!visibleSections.length && wc.snoozedCount > 0) {
      sub.textContent = "Everything here is snoozed for later.";
      if (summary) {
        summary.hidden = false;
        summary.textContent = `${wc.snoozedCount} weakness${wc.snoozedCount === 1 ? "" : "es"} snoozed · ${wc.resolvedCount} misconception${wc.resolvedCount === 1 ? "" : "s"} resolved`;
      }
      host.replaceChildren();
      host.appendChild(snoozeToggle(hiddenSnoozed, wc.snoozedCount));
      renderMissedTail();
      return;
    }
    sub.textContent = "Weaknesses, sorted by what matters most — each one is solvable.";
    if (summary) {
      summary.hidden = false;
      summary.textContent = `${wc.totalProblems} weakness${wc.totalProblems === 1 ? "" : "es"} to repair · ${wc.resolvedCount} misconception${wc.resolvedCount === 1 ? "" : "s"} resolved · ${wc.recurringCount} still recurring` +
        (wc.snoozedCount && !showSnoozed ? ` · ${wc.snoozedCount} snoozed for later` : "");
    }
    host.replaceChildren();
    if (hiddenSnoozed > 0 || (showSnoozed && wc.snoozedCount > 0)) {
      host.appendChild(snoozeToggle(hiddenSnoozed, wc.snoozedCount));
    }
    visibleSections.forEach((section) => {
      const card = document.createElement("div");
      card.className = "card review-group";
      const head = document.createElement("div");
      head.className = "rg-head";
      const title = document.createElement("h2");
      title.className = "rg-title";
      title.textContent = section.title;
      const count = document.createElement("span");
      count.className = "badge warn";
      count.textContent = String(section.problems.length);
      head.append(title, count);
      const why = document.createElement("p");
      why.className = "rg-why";
      why.textContent = section.why;
      const items = document.createElement("ul");
      items.className = "rg-items";
      section.problems.slice(0, 5).forEach((it) => {
        const li = document.createElement("li");
        const label = document.createElement("b");
        label.textContent = it.label;
        const detail = document.createElement("span");
        detail.textContent = it.problem;
        li.append(label, detail);
        // One-tap actions per problem: repair/drill first, rule + later secondary.
        const actions = document.createElement("div");
        actions.className = "rg-actions";
        const drill = document.createElement("button");
        drill.type = "button";
        drill.className = "btn ghost rg-drill";
        drill.innerHTML = `${icon("target", 13)} ${it.actions.includes("repair") ? "Repair misconception" : "5-question drill"}`;
        on(drill, "click", () => {
          const qs = it.drillIds.map((id) => getQuestion(id)).filter(Boolean);
          if (qs.length) startPractice(shuffle(qs).slice(0, 5), it.label, "review");
        });
        actions.appendChild(drill);
        const rule = document.createElement("button");
        rule.type = "button";
        rule.className = "btn ghost rg-rule";
        rule.textContent = "View rule";
        on(rule, "click", () => {
          const q = getQuestion(it.questionIds[0]);
          if (q) {
            const note = li.querySelector(".rg-rule-note") || document.createElement("span");
            note.className = "rg-rule-note";
            note.textContent = q.why;
            li.appendChild(note);
            rule.disabled = true;
          }
        });
        actions.appendChild(rule);
        const later = document.createElement("button");
        later.type = "button";
        later.className = "btn ghost rg-later";
        const snoozeId = Coach.snoozeKey(it.category, it.key);
        if (it.snoozed) {
          li.classList.add("rg-snoozed");
          later.textContent = "Bring back";
          on(later, "click", () => {
            const st = ctx.getState();
            if (st.reviewSnoozed) delete st.reviewSnoozed[snoozeId];
            ctx.save();
            render();
          });
        } else {
          later.textContent = "Mark for later";
          on(later, "click", () => {
            const st = ctx.getState();
            if (!st.reviewSnoozed || typeof st.reviewSnoozed !== "object") st.reviewSnoozed = {};
            st.reviewSnoozed[snoozeId] = Date.now();
            ctx.save();
            render();
          });
        }
        actions.appendChild(later);
        li.appendChild(actions);
        items.appendChild(li);
      });
      card.append(head, why, items);
      host.appendChild(card);
    });
    renderMissedTail();
  }

  /** Drill every missed question (the Review screen's bottom action). */
  function drillAll() {
    const { Core, getState, getBank, getQuestion, startPractice, shuffle, alert } = ctx;
    const missed = Core.missedQuestions(getBank(), getState().qstats);
    const qs = missed.map((q) => getQuestion(q.id)).filter(Boolean);
    if (!qs.length) { (alert || window.alert)("Nothing missed yet — keep practicing!"); return; }
    startPractice(shuffle(qs).slice(0, 15), "Missed Questions", "review");
  }

  /** Answer-fluency panel on the Progress screen. */
  function renderFluency() {
    const { Core, getState, getBank } = ctx;
    const state = getState();
    const f = Core.answerFluency(getBank(), state.qstats, state.rtSamples);
    const body = $("fluencyBody");
    if (!body) return;
    if (!f.ready) {
      body.innerHTML = `<p class="muted">How quickly you answer says something the right/wrong count cannot:
        a fast wrong answer is a misconception, a slow right one is knowledge that is not automatic yet.
        Answer ${f.needed} more question${f.needed === 1 ? "" : "s"} and this fills in — the thresholds are
        your own typical speed, not a fixed stopwatch.</p>`;
      return;
    }
    const secs = (ms) => (ms / 1000).toFixed(1) + "s";
    const list = (items, empty) => items.length
      ? `<ul class="fluency-list">${items.slice(0, 5).map(x =>
          `<li><span>${ctx.escapeHTML(x.q.q)}</span><b>×${x.count}</b></li>`).join("")}</ul>`
      : `<p class="muted">${empty}</p>`;
    body.innerHTML = `
      <p class="muted">Measured against your own pace: about ${secs(f.medianMs)} is typical,
        over ${secs(f.slowMs)} is slow for you. Based on your last ${f.samples} answers.</p>
      <h3 class="fluency-head">Answered fast and wrong — ${f.misconceptions.length}</h3>
      <p class="muted">You were sure and you were wrong. These are the ones you cannot catch yourself on,
        so practice surfaces them first.</p>
      ${list(f.misconceptions, "None — nothing you got wrong came quickly.")}
      <h3 class="fluency-head">Answered slow and right — ${f.fragile.length}</h3>
      <p class="muted">You worked these out rather than knowing them. That holds up in practice and
        slips under exam time pressure.</p>
      ${list(f.fragile, "None — the ones you get right, you get right quickly.")}`;
  }

  /** "Show N snoozed" / "Hide snoozed" toggle above the weakness groups. */
  function snoozeToggle(hiddenSnoozed, totalSnoozed) {
    const bar = document.createElement("div");
    bar.className = "rg-snooze-bar";
    const t = document.createElement("button");
    t.type = "button";
    t.className = "btn ghost rg-snooze-toggle";
    t.textContent = showSnoozed
      ? `Hide ${totalSnoozed} snoozed`
      : `Show ${hiddenSnoozed} snoozed for later`;
    on(t, "click", () => { showSnoozed = !showSnoozed; render(); });
    bar.appendChild(t);
    return bar;
  }

  window.RoadReadyReviewUI = {
    /**
     * @param {{Coach, Core, getState, getBank, byId, icon, escapeHTML,
     *          sourceCitationHTML, signArt, startPractice, shuffle, alert?}} deps
     */
    init(deps) { ctx = deps; },
    render, drillAll, renderFluency,
  };
})();
