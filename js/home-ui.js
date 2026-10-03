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
    const { Core, Coach, getState, getBank, CATEGORIES, todayStr, validTestDate, hazardInfoForPack, hazardScenarioCount, checkProgressAchievements, levelFor } = ctx;
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
    });
    const rec = coachPlan.primary;
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
    const renderCoachPlan = (r) => {
      const size = r.questionCount ? `${r.questionCount} questions` : r.minutes ? `${r.minutes} min` : "";
      $("planTitle").textContent = r.title;
      $("planDetail").textContent = [size, r.detail].filter(Boolean).join(" · ");
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
      planBtn.textContent = r.type === Coach.REC_TYPES.TAKE_MOCK ? "Take a mock"
        : r.type === Coach.REC_TYPES.LIGHT_REVIEW ? "Start light review"
        : r.questionCount ? `Start ${r.questionCount}-question session`
        : "Start today's session";
      planBtn.dataset.action = "coach";
    };
    if (!validTestDate()) {
      renderCoachPlan(rec);
      $("planMeta").textContent = "Set a test date for a dated plan — this adapts to your data either way.";
      planBtn.textContent = rec.questionCount ? `Start ${rec.questionCount}-question session` : "Start today's session";
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
