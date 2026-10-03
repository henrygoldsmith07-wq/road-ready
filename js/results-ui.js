/* Road Ready — results & mock-debrief UI.
 *
 * Extracted from app.js: the session results screen (score, topic breakdown,
 * missed-question review list) and the concise mock debrief (concept
 * weaknesses, repeated misconceptions, slow answers, regressions). The
 * diagnostic logic lives in js/coach.js (mockDebrief / postMockDrill) — this
 * file renders and wires only.
 *
 * Classic-script module: dependencies arrive via RoadReadyResultsUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }

  function confetti() {
    const host = document.querySelector(".results-card");
    if (!host) return;
    const colors = ["#f4f4f5", "#a1a1aa", "#d4d4d8", "#71717a", "#e4e4e7", "#52525b"];
    for (let i = 0; i < 36; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.9).toFixed(2) + "s";
      p.style.animationDuration = (2.2 + Math.random() * 1.6).toFixed(2) + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      host.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  /**
   * Concise mock debrief block under the score: concept weaknesses, repeated
   * misconceptions, slow answers, right→wrong regressions, recently-learned
   * wins. Exams only — practice sessions get no debrief block.
   */
  function renderDebrief(d, isExam) {
    const host = $("debrief");
    if (!host) return;
    host.replaceChildren();
    if (!isExam) { host.hidden = true; return; }
    host.hidden = false;
    const frag = document.createDocumentFragment();
    const add = (title, lines) => {
      if (!lines.length) return;
      const h = document.createElement("h3");
      h.className = "debrief-head";
      h.textContent = title;
      const ul = document.createElement("ul");
      ul.className = "debrief-list";
      lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        ul.appendChild(li);
      });
      frag.append(h, ul);
    };
    add("Concept-level weaknesses", d.conceptWeaknesses.slice(0, 4).map((c) =>
      `${c.label}: ${c.missed} of ${c.total} wrong${c.kind === "misconception" ? " — repeated errors on the same rule" : c.kind === "fluency" ? " — right but slow elsewhere" : ""}.`));
    add("Repeated misconceptions", d.repeatedMisconceptions.slice(0, 3).map((m) =>
      `${m.label}: ${m.errors} wrong answers so far — a comparison of the confused rules is queued in Review Missed.`));
    add("Slower answers", d.slowAnswers.slice(0, 3).map((s) =>
      `${s.label}: correct, but slower than your own typical pace.`));
    add("Changed since you last saw them", d.regressions.slice(0, 3).map((x) =>
      `${x.label}: right before, wrong this time.`).concat(d.recentlyLearned.slice(0, 2).map((x) =>
      `${x.label}: learned recently and held up this time.`)));
    if (frag.childNodes.length) frag.prepend(Object.assign(document.createElement("p"), {
      className: "debrief-intro",
      textContent: `What this mock revealed — ${d.correct} of ${d.total} correct.`,
    }));
    else frag.prepend(Object.assign(document.createElement("p"), {
      className: "debrief-intro",
      textContent: "Clean mock — no concept-level weaknesses to report.",
    }));
    host.appendChild(frag);
  }

  /**
   * Render the whole results screen. `r` is the session outcome built by
   * app.js's finishSession: {pass, correct, total, timedOut, answers, title,
   * sub}. Returns the post-mock drill (or null) so the caller can store it on
   * the session and wire the primary action.
   */
  function show(r, session) {
    const { Coach, Core, CATEGORIES, getState, getBank, getQuestion, icon, escapeHTML, sourceCitationHTML, signArt, showView } = ctx;
    const state = getState();
    const bank = getBank();
    const isExam = session.mode === "exam";

    $("resultEmoji").innerHTML = icon(r.pass ? "trophy" : "x-circle", 54);
    $("resultTitle").textContent = r.title;
    $("resultScore").textContent = Math.round(100 * r.correct / r.total) + "%";
    $("resultScore").className = "score-big " + (r.pass ? "pass" : "fail");
    $("resultSub").textContent = (r.timedOut ? "Time ran out — your unanswered questions were counted. " : "") + r.sub;

    // Mock debrief: one diagnostic summary, not a chart farm.
    const debrief = Coach.mockDebrief({
      bank,
      answers: r.answers.map((a) => ({ ...a })),
      qstats: state.qstats,
      misconceptions: state.misconceptions,
      categories: CATEGORIES,
      slowMs: Core.rtPercentiles(state.rtSamples) ? Core.rtPercentiles(state.rtSamples).p75 : null,
      nowMs: Date.now(),
    });
    renderDebrief(debrief, isExam);

    const grid = $("resultGrid");
    grid.innerHTML = "";
    debrief.topicBreakdown.forEach((t) => {
      const div = document.createElement("div");
      div.className = "result-cat " + (t.ok === t.total ? "good" : t.ok / t.total >= 0.5 ? "mid" : "bad");
      div.innerHTML = `${icon((CATEGORIES[t.id] || {}).icon || "book", 14)} <span>${escapeHTML(t.name)}</span><b>${t.ok}/${t.total}</b>`;
      grid.appendChild(div);
    });

    const missed = r.answers.filter((a) => !a.right);
    const list = $("reviewList");
    list.innerHTML = missed.length
      ? missed.map((a) => {
          const q = getQuestion(a.qid);
          return `<div class="review-item card">
            ${q.signId ? `<div class="sign-frame small">${signArt(q.signId, 70)}</div>` : ""}
            <div>
              <div class="ri-q">${escapeHTML(q.q)}</div>
               <div class="ri-a ok">${icon("check", 14)} ${escapeHTML(q.choices[q.a])}</div>
               <div class="ri-why">${escapeHTML(q.why)}</div>
               ${sourceCitationHTML(q)}
             </div></div>`;
        }).join("")
      : `<p class="muted">Nothing missed — flawless.</p>`;
    $("reviewSub").textContent = `${missed.length} question${missed.length === 1 ? "" : "s"} to review`;
    $("btnDrillMissed").style.display = missed.length ? "" : "none";
    $("btnDrillMissed").innerHTML = `${icon("target", 15)} Drill These Questions`;
    session.lastMissed = missed.map((a) => a.qid);

    // "Turn this mock into a targeted study session": a drill built from the
    // concepts missed — different questions, same rules.
    let lastDrill = null;
    if (isExam && missed.length) {
      lastDrill = Coach.postMockDrill({ bank, answers: r.answers, qstats: state.qstats });
      const again = $("btnAgain");
      if (again) {
        again.innerHTML = `${icon("target", 15)} Turn this mock into a study session`;
        again.setAttribute("aria-label", `Start a targeted ${lastDrill.questions.length}-question drill on the concepts missed in this mock`);
      }
      const drillNote = document.createElement("p");
      drillNote.className = "debrief-drill-note";
      drillNote.textContent = `${lastDrill.reason}${lastDrill.note ? " " + lastDrill.note : ""}`;
      $("debrief").appendChild(drillNote);
    }
    session.lastDrill = lastDrill;
    showView("results");
    if (r.pass && isExam) confetti();
  }

  window.RoadReadyResultsUI = {
    /**
     * @param {{Coach, Core, CATEGORIES, getState, getBank, byId, icon,
     *          escapeHTML, sourceCitationHTML, signArt, showView}} deps
     */
    init(deps) { ctx = deps; },
    show, renderDebrief, confetti,
  };
})();
