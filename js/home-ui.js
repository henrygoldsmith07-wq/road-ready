/* Road Ready — home & Today Plan UI.
 *
 * Extracted from app.js: the home screen (hero, Today Plan card, topic grid,
 * weak spots) and the study-progress panel. The recommendation logic lives in
 * js/coach.js and js/core.js — this file renders the coach's plan and wires
 * the single primary action.
 *
 * Classic-script module: dependencies arrive via RoadReadyHomeUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); }

  /* Status only, by design. The single next action for today lives in the
   * Today Plan card, which states the question count, the reason behind it
   * and carries the one primary action. */
  function renderReadinessPanel() {
    const { Core, getState, CATEGORIES, catQ, readiness, predictionCalibrationSamples, buildCalibrationCurve, CALIBRATION_CONTEXT } = ctx;
    const host = $("readinessPanel");
    if (!host) return;
    host.hidden = false;
    const state = getState();
    const theoryPct = Math.round(readiness() * 100);
    const pct = theoryPct;

    // per-topic mastery snapshot
    const topics = Object.keys(CATEGORIES).map((id) => {
      const qs = catQ(id);
      return {
        id,
        name: CATEGORIES[id].name,
        mastery: Core.topicMastery(qs, state.qstats),
        seen: qs.some((q) => state.qstats[q.id] && state.qstats[q.id].seen > 0),
      };
    });
    const { strong, risk } = Core.strongAndRiskTopics(topics);
    const spreadPts = (() => { const sp = Core.mockStability(state.exams, 3); return sp == null ? null : Math.round(sp * 100); })();
    const predictionSamples = predictionCalibrationSamples();
    const narrative = Core.readinessNarrative(Object.assign({
      readinessPct: theoryPct,
      curve: buildCalibrationCurve(predictionSamples),
      riskTopics: risk.map((t) => t.name),
      stabilitySpread: spreadPts,
    }, CALIBRATION_CONTEXT()));

    const calEl = $("rpCalLine");
    if (calEl) {
      // Readiness stays labelled uncalibrated until real results exist.
      calEl.hidden = false;
      calEl.textContent = narrative.mode === "calibrated"
        ? narrative.text
        : `Uncalibrated estimate — ${narrative.text}`;
    }

    // SCOPE, not calibration: where the exam scores a section this trainer
    // cannot measure, say so on the progress card itself. A GB learner's 100%
    // covers the 50-question section; the real test also scores 14 hazard clips.
    // Without this line the number silently overstates what has been proved.
    const scopeEl = $("rpScopeNote");
    if (scopeEl) {
      const hz = ctx.hazardInfoForPack ? ctx.hazardInfoForPack() : {};
      if (hz.includedInExam && hz.unscoredSectionNote) {
        scopeEl.hidden = false;
        scopeEl.textContent = hz.unscoredSectionNote;
      } else {
        scopeEl.hidden = true;
        scopeEl.textContent = "";
      }
    }
    const band = pct <= 0 && !topics.some((t) => t.seen) ? "Not Started" : Core.readinessBand(pct).label;
    const decidedPredictions = predictionSamples.filter((s) => s.result === "pass" || s.result === "fail");
    $("rpBand").textContent = decidedPredictions.length ? band : `${band} · uncalibrated`;

    const items = [];
    strong.forEach((t) => items.push(`<li class="rp-strong"><span class="rp-glyph">✓</span> Strong: ${t.name.toLowerCase()}</li>`));
    risk.forEach((t) => items.push(`<li class="rp-risk"><span class="rp-glyph">△</span> Risk: ${t.name.toLowerCase()}</li>`));
    if (!items.length) items.push('<li class="muted">Answer a few questions and your strong/risk areas will appear here.</li>');
    $("rpList").innerHTML = items.join("");
  }

  /** The Today Plan card: the coach's single ranked recommendation. */
  function renderPlan() {
    const { Core, Coach, Evidence, getState, getBank, CATEGORIES, todayStr, validTestDate, hazardInfoForPack, hazardScenarioCount, checkProgressAchievements, levelFor } = ctx;
    const state = getState();
    const bank = getBank();

    const passedMock = state.exams.some((e) => e.pass);
    const TERMS = ctx.termsForPack();
    $("heroSub").textContent = state.answered === 0
      ? `Study a little every day and walk into your ${TERMS.agencyShort} with confidence.`
      : passedMock
        ? "You've passed a practice mock exam — keep drilling to stay sharp."
        : "Keep going — review your weak spots and drill the questions you missed.";

    const lv = levelFor(state.xp);
    $("heroLvl").textContent = state.answered ? `Level ${lv.lvl} · ${state.xp} XP` : "";
    const HAZARD_INFO = hazardInfoForPack();
    const hazardTag = HAZARD_INFO.includedInExam
      ? "core section of your theory test (real test: 14 clips, 44/75)"
      : "bonus training — not part of most U.S. knowledge exams";
    $("hazardBestLabel").textContent = state.hazardBest
      ? `Best score: ${state.hazardBest}/${hazardScenarioCount() * 5} — ${hazardTag}`
      : `Spot developing hazards early (${hazardTag})`;
    checkProgressAchievements();

    const plan = Core.studyPlan(bank, state.qstats, state.exams, state.daily, state.settings.testDate, todayStr());
    const coachPlan = Coach.recommend({
      bank,
      qstats: state.qstats,
      exams: state.exams,
      daily: state.daily,
      misconceptions: state.misconceptions,
      categories: CATEGORIES,
      testDate: validTestDate() ? state.settings.testDate : "",
      today: todayStr(),
      nowMs: Date.now(),
      hazardPerception: HAZARD_INFO,
      hazardLog: state.hazardLog,
      hazardCategoryOf: ctx.hazardCategories,
      hazardCategoryLabel: ctx.hazardCategoryLabel,
      terminology: TERMS,
    });
    const rec = coachPlan.primary;
    // Learning evidence: the plan was SHOWN. Recorded once per distinct
    // recommendation shown (deduplicated by action key, not per render), so
    // "recommendation completion" has a real shown-but-ignored denominator.
    if (Evidence && rec) {
      const displayKey = `plan-${rec.type}-${(rec.conceptKeys || []).join(",")}`;
      const alreadyShown = (state.coachEvents || []).some((e) => e && e.kind === "plan-display" && e.sessionId === displayKey);
      if (!alreadyShown) {
        state.coachEvents = Evidence.recordRecommendation(state.coachEvents, {
          sessionId: displayKey,
          type: rec.type,
          intervention: Core.interventionFor(rec.type),
          followed: false, // shown, not yet started
          kind: "plan-display",
          conceptKeys: rec.conceptKeys,
          jurisdiction: state.settings.statePack,
          before: {
            conceptMastery: rec.evidence && rec.evidence.length && rec.evidence[0].mastery != null ? rec.evidence[0].mastery : null,
            misconceptions: Coach.activeMisconceptions(state.misconceptions).length,
          },
        }, Date.now());
        ctx.save();
      }
    }
    const t = plan.todayCount;
    const target = Math.max(1, plan.dailyTarget);
    const goalEl = $("dailyGoal");
    goalEl.querySelector(".dg-bar-fill").style.width = Math.min(100, 100 * t / target) + "%";
    goalEl.querySelector(".dg-label").innerHTML = t >= target
      ? `Daily goal complete — <b>${t}</b> answered today`
      : `Today's goal: <b>${t}/${target}</b> questions answered`;

    // What changed since the previous session — measured, never guessed.
    const changedEl = $("planChanged");
    const delta = Coach.sessionDelta(state.coach.lastSnapshot, Coach.buildSnapshot({
      bank, qstats: state.qstats, misconceptions: state.misconceptions, nowMs: Date.now(),
      lastMockPct: state.exams.length ? state.exams[state.exams.length - 1].pct : null,
      questionsAnswered: state.answered,
    }));
    if (changedEl) {
      changedEl.hidden = !delta.lines.length;
      changedEl.textContent = delta.lines.length
        ? `Since your last session: ${delta.lines.join(" · ")}.`
        : "";
    }

    const planBtn = $("btnPlanAction");
    const rationaleEl = $("planRationale");
    const kindEl = $("planKind");
    const ISSUE_LABELS = {
      misconception: "Misconception to repair",
      knowledge: "Knowledge gap",
      retention: "Retention work",
      fluency: "Fluency",
      coverage: "Coverage",
      stable: "Maintenance",
    };
    // Plain-English coaching copy: what Road Ready noticed, why it matters,
    // what to do, and what result counts as improvement (js/explain.js).
    const explain = (ctx.Explain && rec) ? ctx.Explain.explainRecommendation(rec, {
      conceptName: rec.conceptKeys.length ? Coach.conceptLabel(rec.conceptKeys[0]) : null,
      errors: rec.evidence && rec.evidence.length ? rec.evidence[0].errors : null,
      fastWrong: rec.evidence && rec.evidence.length ? rec.evidence[0].fastWrong : null,
      overdue: rec.evidence ? rec.evidence.reduce((t, e) => t + (e.overdue || 0), 0) : null,
      coverage: bank.length ? bank.filter((q) => state.qstats[q.id] && state.qstats[q.id].seen).length / bank.length : 0,
      untestedConcepts: rec.issueKind === "coverage" ? Core.groupByConcept(bank).size - new Set(bank.filter((q) => state.qstats[q.id] && state.qstats[q.id].seen).map((q) => Core.conceptKeyOf(q))).size : null,
      bankSize: bank.length,
      slowCount: rec.evidence ? rec.evidence.reduce((t, e) => t + (e.slowRight || 0), 0) : null,
      topicName: rec.topicId ? (CATEGORIES[rec.topicId] || {}).name : null,
      mastery: rec.evidence && rec.evidence.length ? rec.evidence[0].mastery : null,
      encounters: rec.evidence && rec.evidence.length ? rec.evidence[0].encounters : null,
      daysLeft: plan.daysLeft,
      scopeLabel: "current",
    }) : null;

    const renderCoachPlan = (r) => {
      $("planTitle").textContent = r.title;
      $("planDetail").textContent = r.detail || "";
      const amountEl = $("planAmount");
      if (amountEl) { amountEl.hidden = !(explain && explain.amount); amountEl.textContent = explain ? explain.amount : ""; }
      const noticedEl = $("planNoticed");
      if (noticedEl) { noticedEl.hidden = !(explain && explain.noticed); noticedEl.textContent = explain ? explain.noticed : ""; }
      const whyEl = $("planWhy");
      if (whyEl) { whyEl.hidden = !(explain && explain.matters); whyEl.textContent = explain ? explain.matters : ""; }
      const goalEl2 = $("planGoal");
      if (goalEl2) { goalEl2.hidden = !(explain && explain.success); goalEl2.textContent = explain ? `Goal: ${explain.success}` : ""; }
      if (kindEl) {
        kindEl.hidden = !ISSUE_LABELS[r.issueKind];
        kindEl.textContent = ISSUE_LABELS[r.issueKind] ? `What's behind it: ${ISSUE_LABELS[r.issueKind].toLowerCase()}` : "";
      }
      const focus = r.conceptKeys.length
        ? `Focus: ${r.conceptKeys.slice(0, 3).map(Coach.conceptLabel).join(" · ")}`
        : "";
      $("planMeta").textContent = focus;
      rationaleEl.hidden = !r.why.length;
      rationaleEl.replaceChildren(...r.why.map((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        return li;
      }));
      // Advanced evidence stays collapsed — conclusion first, details on demand.
      const evDetails = $("planEvidence");
      const evList = $("planEvidenceList");
      if (evDetails && evList) {
        const evidence = (r.evidence || []).map((e) => {
          const bits = [];
          if (e.errors) bits.push(`${e.errors} wrong answer${e.errors === 1 ? "" : "s"}`);
          if (e.fastWrong) bits.push(`${e.fastWrong} answered quickly`);
          if (e.overdue) bits.push(`${e.overdue} overdue review${e.overdue === 1 ? "" : "s"}`);
          if (e.slowRight) bits.push(`${e.slowRight} slow but correct`);
          if (e.mastery != null) bits.push(`${Math.round(e.mastery * 100)}% mastery`);
          return bits.length ? `${Coach.conceptLabel(e.key || e.topicId || "")}: ${bits.join(", ")}` : null;
        }).filter(Boolean);
        evDetails.hidden = !evidence.length;
        evList.replaceChildren(...evidence.map((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          return li;
        }));
      }
      planBtn.textContent = r.type === Coach.REC_TYPES.TAKE_MOCK ? "Take a mock"
        : r.type === Coach.REC_TYPES.LIGHT_REVIEW ? "Start light review"
        : r.type === Coach.REC_TYPES.HAZARD_TRAINING ? "Practise hazards"
        : r.questionCount ? `Start ${r.questionCount}-question session`
        : "Start today's session";
      planBtn.dataset.action = "coach";
    };
    if (!validTestDate()) {
      renderCoachPlan(rec);
      $("planMeta").textContent = "Set a test date for a dated plan — this adapts to your data either way.";
      planBtn.textContent = rec.type === Coach.REC_TYPES.HAZARD_TRAINING
        ? "Practise hazards"
        : rec.questionCount ? `Start ${rec.questionCount}-question session` : "Start today's session";
      planBtn.dataset.action = "coach";
    } else if (plan.status === "past") {
      $("planTitle").textContent = "Update your test date";
      $("planDetail").textContent = "Your saved test date has passed. Choose a new date to rebuild the plan.";
      $("planMeta").textContent = "Your progress is still here";
      rationaleEl.hidden = true;
      if (kindEl) kindEl.hidden = true;
      if (changedEl) changedEl.hidden = true;
      planBtn.textContent = "Choose a date";
      planBtn.dataset.action = "set-date";
    } else {
      renderCoachPlan(rec);
      const dayLabel = plan.daysLeft === 0 ? "Test day" : `Test in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}`;
      $("planTitle").textContent = `${dayLabel} · ${rec.title}`;
      // the daily target stays visible: the plan says both what to do and how much
      $("planMeta").textContent = `${plan.unseen} unseen · ${plan.weak} weak · ${plan.dailyTarget}/day`;
      planBtn.dataset.action = plan.status === "today" ? "review" : "coach";
      if (plan.status === "today") planBtn.textContent = "Short confidence review";
      // Near the test the plan shows its COMPONENTS, not one bare activity:
      // the split shifts with the phase (far = coverage, final = weaknesses).
      const planList = $("planRationale");
      const days = plan.daysLeft;
      const components = [];
      if (days >= 0 && days <= 14) {
        components.push(`${Math.max(5, Math.round(rec.questionCount * 0.6))} mixed questions`);
        if (plan.weak > 0) components.push("1 weak-concept drill");
        // Hazard work is listed as a plan component only where the exam scores
        // it — listing it for a bonus-training jurisdiction would imply the
        // learner is neglecting a section their test does not contain.
        if (days <= 7 && rec.type !== Coach.REC_TYPES.LIGHT_REVIEW
            && HAZARD_INFO.includedInExam) components.push("2 hazard scenarios");
      }
      if (components.length) {
        planList.hidden = false;
        const existing = [...planList.querySelectorAll("li")].map((li) => li.textContent);
        planList.replaceChildren(...components.map((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          return li;
        }), ...existing.map((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          return li;
        }));
      }
    }
    // The date picker is a secondary control — the plan's own action stays the
    // single primary button. Shown only while the plan is undated.
    const dateBtn = $("btnPlanDate");
    if (dateBtn) dateBtn.hidden = validTestDate() && plan.status !== "past";
  }

  function render() {
    const { Core, CATEGORIES, getState, catQ, catAccuracy, readiness, missedQuestions, icon, startPractice, shuffle } = ctx;
    const state = getState();
    if (!$("view-home")) return;
    renderReadinessPanel();
    const pct = Math.round(readiness() * 100);
    $("ringPct").textContent = pct + "%";
    const C = 2 * Math.PI * 52;
    const fg = $("ringFg");
    fg.style.strokeDasharray = String(C);
    fg.style.strokeDashoffset = String(C * (1 - pct / 100));
    const acc = state.answered ? Math.round(100 * state.correctCount / state.answered) : null;
    $("stAnswered").textContent = String(state.answered);
    $("stAccuracy").textContent = acc === null ? "–" : `${acc}%`;
    $("stStreak").textContent = String(state.streak.count);
    const best = state.exams.length ? Math.max(...state.exams.map((e) => e.pct)) : null;
    $("stBest").textContent = best === null ? "–" : Math.round(best * 100) + "%";

    renderPlan();

    // topics
    const grid = $("topicGrid");
    grid.innerHTML = "";
    Object.entries(CATEGORIES).forEach(([id, c]) => {
      const qs = catQ(id);
      const m = Math.round(100 * Core.topicMastery(qs, state.qstats));
      const seenCount = qs.filter((q) => state.qstats[q.id]).length;
      const b = document.createElement("button");
      b.className = "card topic-card";
      b.innerHTML = `<div class="topic-head"><span class="topic-ico">${icon(c.icon, 19)}</span>
        <div><div class="topic-name">${c.name}</div><div class="topic-desc">${c.desc}</div></div>
        <span class="topic-count">${seenCount}/${qs.length}</span></div>
        <div class="bar"><div class="bar-fill"></div></div>
        <div class="topic-foot"><span>${m}% mastery</span><span class="link">Practice ${icon("chevron-right", 12)}</span></div>`;
      const bar = /** @type {HTMLElement} */ (b.querySelector(".bar-fill"));
      bar.style.setProperty("--w", m + "%");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", c.name + " mastery");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(m));
      on(b, "click", () => startPractice(shuffle(catQ(id)).slice(0, 10), c.name, "home"));
      grid.appendChild(b);
    });

    // weak spots
    const weak = Object.entries(CATEGORIES)
      .map(([id, c]) => ({ id, c, acc: catAccuracy(id) }))
      .filter((x) => x.acc !== null && x.acc < 0.8)
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 4);
    $("weakBadge").textContent = String(missedQuestions().length);
    $("weakList").innerHTML = weak.length
      ? weak.map((x) => `<li><span>${icon(x.c.icon, 15)} ${x.c.name}</span><b>${Math.round(x.acc * 100)}%</b></li>`).join("")
      : `<li class="muted">Answer a few questions and your weak topics will appear here.</li>`;
  }

  window.RoadReadyHomeUI = {
    /**
     * @param {{Core, Coach, CATEGORIES, getState, getBank, catQ, catAccuracy,
     *          readiness, missedQuestions, icon, startPractice, shuffle,
     *          todayStr, validTestDate, termsForPack, hazardInfoForPack,
     *          hazardScenarioCount, checkProgressAchievements, levelFor,
     *          predictionCalibrationSamples, buildCalibrationCurve,
     *          CALIBRATION_CONTEXT}} deps
     */
    init(deps) { ctx = deps; },
    render, renderPlan, renderReadinessPanel,
  };
})();
