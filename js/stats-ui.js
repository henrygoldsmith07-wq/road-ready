/* Road Ready — stats, progress & calibration UI.
 *
 * Extracted from app.js: the Progress screen (stat strip, progress
 * statements, XP/achievements, mastery rows, exam history), the internal
 * learning-evidence report, and the official-test prediction/calibration
 * block. All learning logic stays in js/core.js, js/coach.js, js/mastery.js
 * and js/evidence.js — this file renders and wires only.
 *
 * Classic-script module: dependencies arrive via RoadReadyStatsUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); }

  /**
   * Progress led by the six things that matter: syllabus coverage, mastery,
   * retention, mock performance, hazard skill, recurring misconceptions — as
   * plain statements. The headline study-progress score stays, clearly
   * labelled a heuristic, but no vanity percentage leads the screen.
   */
  function renderProgressSummary() {
    const host = $("progressSummary");
    if (!host) return;
    const { Core, Coach, Mastery, getState, getBank, hazardCategories } = ctx;
    const state = getState();
    const bank = getBank();
    const rows = Mastery ? Mastery.conceptMap(bank, state.qstats, state.misconceptions, Date.now()) : [];
    const summary = Mastery ? Mastery.masterySummary(rows) : null;
    const activeMis = Coach.activeMisconceptions(state.misconceptions).length;
    const lines = [];
    if (summary) {
      const covered = Math.round(summary.covered * 100);
      lines.push(covered >= 95 ? "Most concepts are covered." : `${summary.counts.unseen} concept${summary.counts.unseen === 1 ? " is" : "s are"} still untested.`);
      const weak = summary.counts.learning + summary.counts.seen;
      // "No weak concepts" directly above "1 misconception remains" reads as a
      // contradiction; the misconception is the weak concept. Say "other".
      lines.push(weak ? `${weak} important concept${weak === 1 ? " is" : "s are"} still weak.` : activeMis ? "No other weak concepts outstanding." : "No weak concepts outstanding.");
    }
    const recentMocks = state.exams.slice(-3);
    if (recentMocks.length) {
      const avg = recentMocks.reduce((t, e) => t + e.correct, 0) / recentMocks.length;
      const size = recentMocks[0].total;
      lines.push(`Your last ${recentMocks.length} mock${recentMocks.length === 1 ? "" : "s"} averaged ${Math.round(avg)}/${size}.`);
    }
    lines.push(activeMis
      ? `${activeMis} recurring misconception${activeMis === 1 ? "" : "s"} remain${activeMis === 1 ? "s" : ""}.`
      : "No recurring misconceptions.");
    const hazardRows = Core.hazardCategorySkill(
      (state.hazardLog || []).map((h) => ({ scenario: h.scenario, pts: h.pts, outcome: h.band === "late" || h.band === "early" ? "late" : "window", anticipation: h.band === "instant" || h.band === "good" ? "anticipatory" : "reactive" })),
      hazardCategories,
    );
    if (hazardRows.length >= 2) {
      const best = hazardRows[hazardRows.length - 1];
      const worst = hazardRows[0];
      lines.push(`Hazard detection is strongest for ${best.category.replace(/-/g, " ")} and weakest for ${worst.category.replace(/-/g, " ")}.`);
    }
    host.replaceChildren(...lines.map((line) => {
      const p = document.createElement("p");
      p.className = "progress-statement";
      p.textContent = line;
      return p;
    }));
    host.hidden = lines.length === 0;
  }

  /** The mastery rows double as the entry to the Concept Mastery Map. */
  function renderMasteryList() {
    const { Core, CATEGORIES, getState, getBank, catQ, catAccuracy, icon, openConceptMap } = ctx;
    const state = getState();
    const ml = $("masteryList");
    if (!ml) return;
    ml.innerHTML = "";
    Object.entries(CATEGORIES).forEach(([id, c]) => {
      const qs = catQ(id);
      const m = Math.round(100 * Core.topicMastery(qs, state.qstats));
      const accC = catAccuracy(id);
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.setProperty("--w", m + "%");
      fill.setAttribute("role", "progressbar");
      fill.setAttribute("aria-label", c.name + " mastery");
      fill.setAttribute("aria-valuemin", "0");
      fill.setAttribute("aria-valuemax", "100");
      fill.setAttribute("aria-valuenow", String(m));
      bar.appendChild(fill);
      const row = document.createElement("div");
      row.className = "mastery-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `${c.name} concept map`);
      const open = () => openConceptMap(id);
      on(row, "click", open);
      on(row, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
      const name = document.createElement("span");
      name.className = "m-name";
      name.innerHTML = icon(c.icon, 15); // trusted static SVG from js/icons.js
      name.appendChild(document.createTextNode(" " + c.name));
      const val = document.createElement("span");
      val.className = "m-val";
      val.textContent = m + "%";
      if (accC !== null) {
        const acc = document.createElement("small");
        acc.textContent = " (" + Math.round(accC * 100) + "% acc)";
        val.appendChild(acc);
      }
      row.append(name, bar, val);
      ml.appendChild(row);
    });
    void getBank;
  }

  /** Instructor / parent summary: the same measured values as the statements
   *  above, rendered to plain text by Explain and copied on explicit tap
   *  only — nothing leaves the device except through the learner's own paste.
   *  Uses textContent-safe construction everywhere; the report itself is
   *  plain text, never HTML. */
  function wireShareProgress() {
    const btn = $("btnShareProgress");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    on(btn, "click", () => {
      const { Core, Coach, Explain, CATEGORIES, getState,
        catQ, catAccuracy, termsForPack, todayStr, toast, hazardCategories } = ctx;
      const state = getState();
      let jurisdiction = state.settings.statePack;
      try {
        const t = termsForPack(state.settings.statePack);
        if (t && t.regionLabel) jurisdiction = t.regionLabel;
      } catch { /* keep the pack id */ }
      const weak = Object.entries(CATEGORIES)
        .map(([id, c]) => ({ name: c.name, m: Core.topicMastery(catQ(id), state.qstats), acc: catAccuracy(id) }))
        .filter((t) => t.acc !== null)
        .sort((a, b) => a.m - b.m)
        .slice(0, 3)
        .map((t) => t.name);
      const hazardRows = Core.hazardCategorySkill(
        (state.hazardLog || []).map((h) => ({ scenario: h.scenario, pts: h.pts, outcome: h.band === "late" || h.band === "early" ? "late" : "window", anticipation: h.band === "instant" || h.band === "good" ? "anticipatory" : "reactive" })),
        hazardCategories,
      );
      const text = Explain.instructorSummary({
        jurisdictionLabel: jurisdiction,
        dateISO: todayStr(),
        answered: state.answered,
        accuracyPct: state.answered ? 100 * state.correctCount / state.answered : null,
        streakDays: state.streak.count,
        recentMocks: state.exams.slice(-3).map((e) => ({ correct: e.correct, total: e.total })),
        weakTopics: weak,
        misconceptionCount: Coach.activeMisconceptions(state.misconceptions).length,
        hazard: hazardRows.length >= 2
          ? { best: hazardRows[hazardRows.length - 1].category.replace(/-/g, " "), worst: hazardRows[0].category.replace(/-/g, " ") }
          : null,
        nextStep: weak.length ? `Focus the next session on ${weak[0]}.` : null,
      });
      const done = () => toast("Summary copied", "Paste it into a message to your instructor or parent.", "download");
      const fallback = () => toast("Copy unavailable", "This browser blocked copying — use Settings → Export backup to share the full file instead.", "warn");
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else fallback();
    });
  }

  function render() {
    const { Core, ACHIEVEMENTS, getState, escapeHTML, icon, fmtTime, levelFor,
      hazardScenarioCount, renderFluency,
      renderStudy, readiness,
      PackIds, todayStr } = ctx;
    const state = getState();
    renderProgressSummary();
    wireShareProgress();

    const acc = state.answered ? Math.round(100 * state.correctCount / state.answered) : null;
    $("ssAnswered").textContent = state.answered;
    $("ssAccuracy").textContent = acc === null ? "–" : acc + "%";
    $("ssStreak").textContent = state.streak.count;
    $("ssExams").textContent = state.exams.length;
    $("ssTime").textContent = fmtTime(state.timeStudied);
    $("ssHazard").textContent = state.hazardBest ? state.hazardBest + "/" + (hazardScenarioCount() * 5) : "–";

    const lv = levelFor(state.xp);
    $("xpLabel").textContent = "Level " + lv.lvl;
    $("xpCount").textContent = `${lv.into}/${lv.need} XP`;
    $("xpBar").style.setProperty("--w", Math.round(100 * lv.into / lv.need) + "%");

    const ag = $("achGrid");
    ag.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const has = !!state.achievements[a.id];
      const d = document.createElement("div");
      d.className = "ach" + (has ? " got" : "");
      // Locked and earned differ only by dimming and colour. Say which one in
      // text, so the state survives a screen reader and a monochrome view.
      d.innerHTML = `${icon("award", 20)}<div><span class="sr-only">${has ? "Earned" : "Not yet earned"}: </span><b>${a.name}</b><small>${a.desc}</small></div>`;
      ag.appendChild(d);
    });

    renderFluency();
    renderMasteryList();

    // Test-day sittings show BOTH bars: the generic "pct (correct/total)"
    // line is theory-only, so a hazard-miss fail reads as "88% — failed".
    // A trend line above the list names the repeat miss across sittings.
    const hl = $("historyList");
    let trendEl = $("simTrend");
    const trend = Core.simTrend(state.exams);
    if (trend) {
      if (!trendEl) {
        trendEl = document.createElement("p");
        trendEl.id = "simTrend";
        trendEl.className = "sim-trend";
        hl.before(trendEl);
      }
      trendEl.hidden = false;
      trendEl.textContent = `Test-day: ${trend.text}.`;
    } else if (trendEl) trendEl.hidden = true;
    // Gate record: how often the pre-sim warning fired and what happened.
    // Hidden until a warning has actually fired — no data, no line.
    let gateEl = $("simGateLine");
    const gateStats = Core.simGateStats(state.simGateEvents);
    if (gateStats.warns > 0) {
      if (!gateEl) {
        gateEl = document.createElement("p");
        gateEl.id = "simGateLine";
        gateEl.className = "sim-trend";
        hl.before(gateEl);
      }
      gateEl.hidden = false;
      gateEl.textContent = `Test-day gate: ${gateStats.warns} warning${gateStats.warns === 1 ? "" : "s"} · ` +
        `${gateStats.accepts} tap-through${gateStats.accepts === 1 ? "" : "s"} · ${gateStats.dismisses} stayed to drill.`;
    } else if (gateEl) gateEl.hidden = true;
    const simLine = (rec) => {
      const part = (name, got, need, ok) =>
        `${name} ${got}/${need} ${ok ? "✓" : "✗"}`;
      return `${part("Theory", rec.theory.correct, rec.theory.minCorrect, rec.theory.pass)} · ` +
        `${part("Hazard", rec.hazard.pts, rec.hazard.passPts, rec.hazard.pass)}`;
    };
    hl.innerHTML = state.exams.length
      ? state.exams.slice().reverse().map((e) => {
          const d = new Date(e.date);
          const rec = Core.simRecord(e);
          const cls = rec ? (rec.pass ? "pass" : "fail") : (e.pass ? "pass" : "fail");
          const mark = rec ? rec.pass : e.pass;
          const score = rec ? simLine(rec) : `${Math.round(e.pct * 100)}% (${e.correct}/${e.total})`;
          return `<li class="${cls}">
            <span>${icon(mark ? "check-circle" : "x-circle", 15)} ${escapeHTML(rec ? rec.label : (e.label || "Exam"))}</span>
            <span>${escapeHTML(score)}</span>
            <small>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></li>`;
        }).join("")
      : `<li class="muted">No exams yet — take your first mock exam!</li>`;

    $("selPassMark").value = String(state.settings.passMark);
    $("selExamLen").value = String(state.settings.examLen);
    $("chkFeedback").checked = !!state.settings.feedback;
    if ($("selDailyGoal")) $("selDailyGoal").value = String(Core.clampDailyGoal(state.settings.dailyGoal));
    {
      const rem = Core.sanitizeReminder(state.settings.reminder);
      if ($("chkReminder")) $("chkReminder").checked = rem.enabled;
      if ($("inpReminderTime")) $("inpReminderTime").value = rem.time;
    }
    if ($("selStatePack")) $("selStatePack").value = PackIds.includes(state.settings.statePack) ? state.settings.statePack : "generic";
    if ($("inpTestDate")) {
      $("inpTestDate").value = state.settings.testDate || "";
      $("inpTestDate").min = todayStr();
    }
    const calNarrative = $("calibrationNarrative");
    if (calNarrative) {
      const samples = predictionCalibrationSamples();
      const narrative = Core.readinessNarrative(Object.assign({
        readinessPct: Math.round(readiness() * 100),
        curve: buildCalibrationCurve(samples),
        riskTopics: [],
        stabilitySpread: null,
      }, CALIBRATION_CONTEXT()));
      calNarrative.textContent = narrative.text;
      $("calibrationDisclaimer").textContent = narrative.disclaimer;
    }
    renderCalibration();
    renderEvidenceReport();
    renderStudy();
  }

  /**
   * Internal learning-evidence report (advanced research section): whether
   * followed Coach recommendations move mastery, misconception resolution
   * rates, coach vs self-directed lift, and retention — each scoped to its
   * sample size, "insufficient evidence" where the data cannot carry a claim.
   */
  function renderEvidenceReport() {
    const host = $("evidenceReport");
    if (!host || !ctx.Evidence) return;
    const state = ctx.getState();
    const events = state.coachEvents || [];
    const rep = ctx.Evidence.evaluate(events, {
      nowMs: Date.now(),
      retentionLog: (state.study && state.study.retentionLog) || [],
    });
    host.replaceChildren(...rep.statements.map((line) => {
      const p = document.createElement("p");
      p.className = "state-note";
      p.textContent = line;
      return p;
    }));
  }

  /* ---------------- official-test predictions (primary calibration) ------- */
  function predictionSnapshot() {
    const { Core, readiness, getBank, getState } = ctx;
    const state = getState();
    const bank = getBank();
    const theoryPct = Math.round(readiness() * 100);
    const practicalLog = Core.practicalLog(state);
    return {
      readinessPct: theoryPct,
      mockAvgPct: Math.round((Core.mockAverage(state.exams) ?? 0) * 100),
      diagnosticPct: (() => {
        const d = state.exams.slice().sort((a, b) => a.date - b.date).find((e) => e.tag === "diagnostic");
        return d ? Math.round(d.pct * 100) : null;
      })(),
      coveragePct: Math.round(Core.bankCoverage(bank, state.qstats) * 100),
      stabilitySpread: (() => {
        const s = Core.mockStability(state.exams, 3);
        return s == null ? null : Math.round(s * 100);
      })(),
      questionsSeen: state.answered,
      studyMinutes: Math.round((state.timeStudied || 0) / 60),
      skillsRated: Object.values(practicalLog.slice(-5).reduce((acc, s) => Object.assign(acc, s.skills || {}), {})),
      bank,
    };
  }

  function predictionCalibrationSamples() {
    const state = ctx.getState();
    return (state.predictions || [])
      .filter((p) => p.outcome && (p.outcome.result === "pass" || p.outcome.result === "fail"))
      .map((p) => ({
        readinessPct: p.readinessPct,
        result: p.outcome.result,
        jurisdiction: p.jurisdiction,
        engineVersion: p.readinessEngineVersion,
        date: p.predictionCreatedAt,
      }));
  }

  function freezeOfficialPrediction() {
    const { Core, getState, save, appVersion } = ctx;
    const state = getState();
    const snapshot = predictionSnapshot();
    const prediction = Core.freezePrediction(state.predictions, state.study.participantId || "local-learner", state.settings.statePack, snapshot, {
      intendedTestDate: state.settings.testDate || undefined,
      nowMs: Date.now(),
      appVersion: appVersion(),
    });
    state.predictions = [...(Array.isArray(state.predictions) ? state.predictions : []), prediction];
    save();
    return prediction;
  }

  /**
   * Calibration samples must never mix engines silently. The ACTIVE
   * jurisdiction and the CURRENT readiness/mastery engine version are applied
   * at the single point where calibration data is consumed.
   */
  function CALIBRATION_CONTEXT() {
    const { Core, getState } = ctx;
    return {
      jurisdiction: getState().settings.statePack,
      engineVersion: Core.MASTERY_VERSION,
    };
  }

  function buildCalibrationCurve(samples) {
    return ctx.Core.calibrationCurve(samples, CALIBRATION_CONTEXT());
  }

  function pendingOutcomePrediction() {
    // The pending row shown to the learner is the one the resolver matches an
    // outcome against — attempt identity lives in Core.resolveAttemptPrediction.
    return ctx.Core.resolveAttemptPrediction(ctx.getState().predictions, { jurisdiction: ctx.getState().settings.statePack });
  }

  function logOutcome(result) {
    const { Core, getState, save, toast, renderHome, renderCalibration } = ctx;
    const state = getState();
    const jurisdiction = state.settings.statePack;
    const snapshot = predictionSnapshot();
    const recorded = Core.recordOfficialOutcome(state.predictions, state.outcomes, result, {
      jurisdiction,
      officialTestDate: Core.validIsoDate(state.settings.testDate) ? state.settings.testDate : null,
      nowMs: Date.now(),
      snapshot: {
        progressPct: snapshot.readinessPct,
        mockAvgPct: snapshot.mockAvgPct,
        coveragePct: snapshot.coveragePct,
        stabilitySpread: snapshot.stabilitySpread ?? 0,
        diagnosticPct: snapshot.diagnosticPct ?? undefined,
        jurisdiction,
        questionsSeen: snapshot.questionsSeen,
        studyMinutes: snapshot.studyMinutes,
      },
    });
    if (recorded.duplicate) {
      toast("Outcome already recorded", "This result was already saved against the frozen prediction.", "chart");
      return;
    }
    state.predictions = recorded.predictions;
    state.outcomes = recorded.outcomes;
    save();
    renderCalibration();
    renderHome();
    // Honest confirmation copy: say what actually happened to the frozen
    // prediction. When nothing attached, this is a retrospective journal
    // entry only — never imply a snapshot was preserved.
    if (recorded.attached) {
      toast("Outcome logged", "Recorded against your frozen prediction. Stored only on this device.", "chart");
    } else {
      toast("Outcome saved to journal", "No frozen prediction matched this attempt, so it was kept as a retrospective entry.", "chart");
    }
  }

  function renderCalibration() {
    const host = $("outcomeList");
    if (!host) return;
    const state = ctx.getState();
    const predictions = Array.isArray(state.predictions) ? state.predictions : [];
    const retrospectives = Array.isArray(state.outcomes) ? state.outcomes : [];
    const rows = [];
    predictions.slice().reverse().forEach((p) => {
      const d = new Date(p.predictionCreatedAt);
      const res = p.outcome ? (p.outcome.result === "pass" ? "PASS" : p.outcome.result === "fail" ? "FAIL" : "?") : "PENDING";
      const row = document.createElement("div");
      row.className = "outcome-row";
      const left = document.createElement("span");
      left.textContent = `${d.toLocaleDateString()} · ${p.jurisdiction} · readiness ${p.readinessPct}% · mocks ${p.mockAvgPct}% · coverage ${p.coveragePct}% `;
      const meta = document.createElement("span");
      meta.className = "outcome-meta";
      meta.textContent = `frozen prediction · attempt ${p.attemptNumber} · ${p.evidenceClass} evidence`;
      left.appendChild(meta);
      const right = document.createElement("b");
      right.className = `res-${p.outcome ? p.outcome.result : "pending"}`;
      right.textContent = res;
      row.append(left, right);
      rows.push(row);
    });
    retrospectives.slice().reverse().forEach((o) => {
      const d = new Date(o.date);
      const resLabel = o.result === "pass" ? "PASS" : o.result === "fail" ? "FAIL" : "?";
      const row = document.createElement("div");
      row.className = "outcome-row";
      const left = document.createElement("span");
      left.textContent = `${d.toLocaleDateString()} · ${o.progressPct}% progress · mock avg ${o.mockAvgPct}% · ${o.questionsSeen} questions `;
      const meta = document.createElement("span");
      meta.className = "outcome-meta";
      meta.textContent = "retrospective journal";
      left.appendChild(meta);
      const right = document.createElement("b");
      right.className = `res-${o.result}`;
      right.textContent = resLabel;
      row.append(left, right);
      rows.push(row);
    });
    host.textContent = "";
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "muted mx0";
      p.textContent = "No outcomes logged yet.";
      host.appendChild(p);
      return;
    }
    const frag = document.createDocumentFragment();
    rows.forEach((r) => frag.appendChild(r));
    host.appendChild(frag);
  }

  window.RoadReadyStatsUI = {
    /**
     * @param {{Core, Coach, Mastery, Evidence, CATEGORIES, ACHIEVEMENTS,
     *          getState, getBank, catQ, catAccuracy, icon, escapeHTML, fmtTime,
     *          levelFor, hazardScenarioCount, hazardCategories, renderFluency,
     *          renderStudy, readiness, save, toast, renderHome, showView,
     *          openConceptMap, appVersion, PackIds, todayStr}} deps
     */
    init(deps) { ctx = deps; },
    render, renderProgressSummary, renderMasteryList, renderEvidenceReport,
    predictionSnapshot, predictionCalibrationSamples, freezeOfficialPrediction,
    CALIBRATION_CONTEXT, buildCalibrationCurve, pendingOutcomePrediction,
    logOutcome, renderCalibration,
  };
})();
