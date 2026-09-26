/* Road Ready — learner study (research) UI.
 *
 * Extracted from app.js: enrollment card, confidence survey, study metrics and
 * study-data export. The research GATE itself (what is measured, when
 * improvement counts, what is exported) stays in js/core.js; this file is the
 * rendering and button wiring only. Quiz entry points (diagnostic, memory
 * checks) remain orchestrated by app.js via ctx callbacks.
 *
 * Classic-script module: dependencies arrive via RoadReadyStudyUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); }

  function render() {
    const { Core, getState, save } = ctx;
    const state = getState();
    const intro = $("studyIntro");
    const body = $("studyBody");
    if (!intro || !body) return;
    const enrolled = !!state.study.enrolledAt;
    intro.hidden = enrolled;
    body.hidden = !enrolled;
    if (!enrolled) return;
    $("studyPid").textContent = state.study.participantId;

    const m = Core.studyMetrics({
      enrolledAt: state.study.enrolledAt, exams: state.exams, answered: state.answered,
      timeStudied: state.timeStudied, study: state.study, nowMs: Date.now(),
    });
    const days = Math.max(1, m.daysSinceEnroll || 1);
    $("studyDay").textContent = String(days);
    $("studyMetrics").textContent =
      `Diagnostic ${m.diagnosticPct === null ? "–" : m.diagnosticPct + "%"} · latest mock ${m.latestMockPct === null ? "–" : m.latestMockPct + "%"} · improvement ${m.improvementPct === null ? "–" : (m.improvementPct > 0 ? "+" : "") + m.improvementPct + " pts"}` +
      ` — ${m.questionsAnswered} questions · ${m.studyHours} h · mocks ${m.mockCount} · retention ${m.retentionAttempts ? Math.round(100 * m.retentionCorrect / m.retentionAttempts) + "% (" + m.retentionAttempts + ")" : "–"}`;

    // confidence survey until all topics rated
    const survey = $("confidenceSurvey");
    const rated = new Set(state.study.confidence.map((c) => c.catId));
    const missing = Object.keys(ctx.CATEGORIES).filter((c) => !rated.has(c));
    if (missing.length) {
      survey.hidden = false;
      const prompt = document.createElement("p");
      prompt.className = "outcome-meta mb-6";
      prompt.textContent = "Before studying: how confident are you per topic? (1 = no idea, 5 = very confident)";
      survey.replaceChildren(prompt);
      missing.slice(0, 3).forEach((cat) => {
        const c = ctx.CATEGORIES[cat];
        const row = document.createElement("div");
        row.className = "pl-skill-row";
        const name = document.createElement("span");
        name.className = "pl-skill-name";
        name.textContent = c.name;
        const seg = document.createElement("span");
        seg.className = "seg3";
        [1, 2, 3, 4, 5].forEach((level) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.cat = cat;
          btn.dataset.level = String(level);
          btn.setAttribute("aria-label", `${c.name}: ${level}`);
          btn.setAttribute("aria-pressed", "false");
          btn.textContent = String(level);
          seg.appendChild(btn);
        });
        row.appendChild(name);
        row.appendChild(seg);
        survey.appendChild(row);
      });
      survey.querySelectorAll("button[data-cat]").forEach((b) => on(b, "click", () => {
        const btn = /** @type {HTMLElement} */ (b);
        state.study.confidence.push({ catId: btn.dataset.cat, level: Number(btn.dataset.level) });
        save();
        render();
      }));
      if ($("btnDiagnostic")) $("btnDiagnostic").disabled = true;
    } else {
      survey.hidden = true;
      const done = state.exams.some((e) => e.tag === "diagnostic");
      if ($("btnDiagnostic")) $("btnDiagnostic").disabled = done;
      if ($("btnDiagnostic")) $("btnDiagnostic").textContent = done ? "Baseline recorded ✓" : "Baseline diagnostic exam";
    }

    // retention probes
    const bank = ctx.getBank();
    const pool = Core.retentionProbePool(bank, state.qstats, state.study.retentionLog, Date.now());
    $("btnRetentionProbes").hidden = pool.length === 0;
    $("retentionHint").textContent = pool.length
      ? `${pool.length} question${pool.length === 1 ? "" : "s"} from a week or more ago are ready for a memory check.`
      : `Memory checks appear once you've mastered questions 7+ days ago.`;
  }

  function join() {
    const { Core, getState, save } = ctx;
    if (!window.confirm("Join the learner study?\n\n· Fully anonymous random ID — no account, no personal data\n· Data stays on this device until you export it\n· Free-text notes are never exported")) return;
    const e = Core.createEnrollment(Date.now());
    const state = getState();
    state.study.enrolledAt = e.enrolledAt;
    state.study.participantId = e.participantId;
    save();
    render();
  }

  function exportData() {
    const { Core, getState, appVersion } = ctx;
    const state = getState();
    const bundle = Core.buildStudyExport(state, ctx.getBank(), Date.now(), { appVersion: appVersion() });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `road-ready-study-${state.study.participantId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  window.RoadReadyStudyUI = {
    /** @param {{Core, CATEGORIES, getState, save, getBank, appVersion}} deps */
    init(deps) { ctx = deps; },
    render,
    join,
    exportData,
  };
})();
