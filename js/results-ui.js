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
   * Post-mock diagnostic report — not a chart farm. Answers, in order:
   *   what limited your score (concrete errors, not categories)
   *   biggest opportunity / strongest area
   *   changes since the last mock
   * and leaves ONE dominant action to the caller (the repair session).
   * Exams only — practice sessions get no debrief block.
   */
  function renderDebrief(d, isExam, prevMock) {
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

    // What limited your score: concrete error sources, most costly first.
    const limiters = [];
    for (const c of d.conceptWeaknesses.slice(0, 3)) {
      limiters.push(c.kind === "misconception"
        ? `${c.missed} error${c.missed === 1 ? "" : "s"} from one recurring misconception — ${c.label.toLowerCase()}.`
        : c.kind === "coverage"
          ? `${c.missed} mistake${c.missed === 1 ? "" : "s"} from unseen concepts — ${c.label.toLowerCase()}.`
          : `${c.missed} mistake${c.missed === 1 ? "" : "s"} in ${c.label.toLowerCase()}.`);
    }
    for (const s of d.slowAnswers.slice(0, 2)) {
      limiters.push(`A slow answer in ${s.label.toLowerCase()} — correct, but under time pressure that is a risk.`);
    }
    add("What limited your score", limiters);

    // Biggest opportunity / strongest area in one line each.
    const opp = d.conceptWeaknesses[0];
    const strong = d.topicBreakdown[d.topicBreakdown.length - 1];
    if (opp) {
      const p = document.createElement("p");
      p.className = "debrief-highlight";
      p.textContent = `Biggest opportunity: ${opp.label}.`;
      frag.appendChild(p);
    }
    if (strong && strong.ok === strong.total && strong.total > 0) {
      const p = document.createElement("p");
      p.className = "debrief-highlight";
      p.textContent = `Strongest area: ${strong.name} — ${strong.ok} of ${strong.total} correct.`;
      frag.appendChild(p);
    }

    // Changes since the previous mock (measured, never guessed).
    if (prevMock) {
      const marks = d.correct - prevMock.correct;
      const lines = [];
      lines.push(`${marks >= 0 ? "+" : ""}${marks} mark${Math.abs(marks) === 1 ? "" : "s"} versus your last mock (${prevMock.correct}/${prevMock.total}).`);
      const prevMis = (prevMock.repeatedMisconceptions || []).length;
      const nowMis = d.repeatedMisconceptions.length;
      if (nowMis < prevMis) lines.push(`${prevMis - nowMis} fewer repeated mistake${prevMis - nowMis === 1 ? "" : "s"}.`);
      else if (nowMis > prevMis) lines.push(`${nowMis - prevMis} new repeated mistake${nowMis - prevMis === 1 ? "" : "s"} since last time.`);
      if (prevMock.coveragePct != null && d.coveragePct != null && d.coveragePct !== prevMock.coveragePct) {
        lines.push(`Coverage ${d.coveragePct - prevMock.coveragePct >= 0 ? "+" : ""}${d.coveragePct - prevMock.coveragePct}%.`);
      }
      add("Changes since your last mock", lines);
    }

    if (frag.childNodes.length) frag.prepend(Object.assign(document.createElement("p"), {
      className: "debrief-intro",
      textContent: `What this mock revealed — ${d.correct} of ${d.total} correct.`,
    }));
    else frag.prepend(Object.assign(document.createElement("p"), {
      className: "debrief-intro",
      textContent: "Clean mock — nothing held your score back this time.",
    }));
    host.appendChild(frag);
  }

  /**
   * Render the whole results screen. `r` is the session outcome built by
   * app.js's finishSession: {pass, correct, total, timedOut, answers, title,
   * sub}. Returns the post-mock drill (or null) so the caller can store it on
   * the session and wire the primary action.
   */
  /**
   * Practice session summary: not just the score, but what the session DID —
   * concepts strengthened, misconceptions resolved, what is still weak, and
   * the best next action. Creates a feeling of progression, honestly measured.
   */
  function renderSessionSummary(summary) {
    const host = $("sessionSummary");
    if (!host) return;
    host.replaceChildren();
    host.hidden = false;
    const frag = document.createDocumentFragment();
    const intro = document.createElement("p");
    intro.className = "debrief-intro";
    intro.textContent = "Session complete";
    frag.appendChild(intro);

    const lines = [];
    if (summary.questionCount) lines.push(`${summary.questionCount} question${summary.questionCount === 1 ? "" : "s"} · ${summary.correct} correct`);
    if (summary.strengthened.length) {
      lines.push(`${summary.strengthened.length} concept${summary.strengthened.length === 1 ? "" : "s"} strengthened: ${summary.strengthened.slice(0, 3).join(", ")}`);
    }
    if (summary.resolvedMisconceptions.length) {
      lines.push(`${summary.resolvedMisconceptions.length} misconception${summary.resolvedMisconceptions.length === 1 ? "" : "s"} resolved: ${summary.resolvedMisconceptions.slice(0, 2).join(", ")}`);
    }
    if (summary.stillWeak.length) {
      lines.push(`${summary.stillWeak.length} concept${summary.stillWeak.length === 1 ? "" : "s"} still weak: ${summary.stillWeak.slice(0, 3).join(", ")}`);
    }
    if (summary.coverageDelta != null && summary.coverageDelta !== 0) {
      lines.push(`Coverage ${summary.coverageDelta > 0 ? "+" : ""}${summary.coverageDelta}%`);
    }
    if (!lines.length) lines.push("No measurable change yet — that is fine early on; keep going.");

    const ul = document.createElement("ul");
    ul.className = "debrief-list";
    lines.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    });
    frag.appendChild(ul);

    if (summary.nextAction) {
      const next = document.createElement("p");
      next.className = "debrief-highlight";
      next.textContent = `Best next action: ${summary.nextAction}.`;
      frag.appendChild(next);
    }
    host.appendChild(frag);
  }

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
    renderDebrief(debrief, isExam, (() => {
      // Previous mock for the "changes since last mock" comparison: the exam
      // row for THIS mock is already pushed, so the one before it is last-1.
      const exams = state.exams || [];
      const prev = isExam && exams.length >= 2 ? exams[exams.length - 2] : null;
      return prev ? { correct: prev.correct, total: prev.total, pct: prev.pct } : null;
    })());

    const grid = $("resultGrid");
    grid.innerHTML = "";
    debrief.topicBreakdown.forEach((t) => {
      const div = document.createElement("div");
      div.className = "result-cat " + (t.ok === t.total ? "good" : t.ok / t.total >= 0.5 ? "mid" : "bad");
      div.innerHTML = `${icon((CATEGORIES[t.id] || {}).icon || "book", 14)} <span>${escapeHTML(t.name)}</span><b>${t.ok}/${t.total}</b>`;
      grid.appendChild(div);
    });

    // Session summary for practice: what the session actually changed, not
    // just the score — concepts strengthened, misconceptions resolved, what is
    // still weak, and the best next action.
    if (!isExam) {
      const summary = Coach.sessionSummary({
        answers: r.answers.map((a) => ({ ...a })),
        qstats: state.qstats,
        misconceptions: state.misconceptions,
        byId: (id) => getQuestion(id),
        sessionStartedAt: session.startedAt || (Date.now() - 3600000),
        snapshot: Coach.buildSnapshot({
          bank, qstats: state.qstats, misconceptions: state.misconceptions,
          questionsAnswered: state.answered, nowMs: Date.now(),
        }),
      });
      renderSessionSummary(summary);
    }

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
