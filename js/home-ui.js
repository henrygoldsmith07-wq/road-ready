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

  /** "19:00" → "7:00 PM". Display only; the stored value stays 24-hour. */
  function formatReminderTime(hm) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm || "");
    if (!m) return hm || "";
    const h12 = Number(m[1]) % 12 || 12;
    return `${h12}:${m[2]} ${Number(m[1]) >= 12 ? "PM" : "AM"}`;
  }

  /** Has this learner produced any answer at all? Drives the honest floor of
   *  the score labels: a score that rounds to zero is "Getting Started", not
   *  "Not Started", once something has actually been recorded. */
  function hasEvidence(state) {
    if (!state) return false;
    if (state.answered > 0) return true;
    const qstats = state.qstats || {};
    for (const id in qstats) {
      const st = qstats[id];
      if (st && st.seen > 0) return true;
    }
    return false;
  }

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
    const evidence = hasEvidence(state);
    const spreadPts = (() => { const sp = Core.mockStability(state.exams, 3); return sp == null ? null : Math.round(sp * 100); })();
    const predictionSamples = predictionCalibrationSamples();
    const narrative = Core.readinessNarrative(Object.assign({
      readinessPct: theoryPct,
      curve: buildCalibrationCurve(predictionSamples),
      riskTopics: risk.map((t) => t.name),
      stabilitySpread: spreadPts,
      hasEvidence: evidence,
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
    const band = Core.readinessBand(pct, evidence).label;
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

    const plan = Core.studyPlan(bank, state.qstats, state.exams, state.daily, state.settings.testDate, todayStr(), Core.clampDailyGoal(state.settings.dailyGoal));
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
    // Retention is part of the goal, not a footnote: answering only new
    // questions can complete the count while spaced reviews pile up. The
    // line names due reviews, and a "complete" count with overdue reviews
    // says so instead of declaring victory.
    const reviewsDue = plan.reviewsDue || 0;
    const overdueDue = plan.overdueToday || 0;
    const dueSuffix = reviewsDue > 0
      ? ` · <b>${reviewsDue}</b> review${reviewsDue === 1 ? "" : "s"} due${overdueDue > 0 ? ` (${overdueDue} overdue)` : ""}`
      : "";
    const stillDueSuffix = reviewsDue > 0
      ? ` · <b>${reviewsDue}</b> review${reviewsDue === 1 ? "" : "s"} still due`
      : "";
    goalEl.querySelector(".dg-label").innerHTML = t >= target
      ? `Daily goal complete — <b>${t}</b> answered today${stillDueSuffix}`
      : `Today's goal: <b>${t}/${target}</b> questions answered${dueSuffix}`;

    // Reminder status: one honest line under the goal bar. Set → states the
    // time. Unset but with history → offers the settings path, never a nag
    // on a brand-new learner's first screen.
    const dgRem = $("dgReminder");
    if (dgRem) {
      const rem = Core.sanitizeReminder(state.settings.reminder);
      dgRem.textContent = "";
      if (rem.enabled) {
        dgRem.hidden = false;
        dgRem.textContent = `Reminder on · ${formatReminderTime(rem.time)}`;
      } else if (state.answered > 0) {
        dgRem.hidden = false;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dg-reminder-link";
        b.textContent = "Turn on a daily reminder";
        on(b, "click", () => ctx.showView("settings"));
        dgRem.appendChild(b);
      } else {
        dgRem.hidden = true;
      }
    }

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
      seenAccuracy: state.answered ? state.correctCount / state.answered : null,
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
    // Fresh learners get a first value in ~2 minutes: an 8-question baseline
    // spread across topics. Its answers seed the mastery maps, so the very
    // next Today Plan is personal instead of generic coverage.
    // A set test date already gives a fresh learner a dated plan (covered by
    // e2e: "test date builds a persistent daily plan") — the baseline owns
    // only the undated fresh screen, where the plan would otherwise be
    // generic coverage with no personal signal behind it.
    //
    // "Fresh" means NO learning signal at all, not merely an answer count of
    // zero. A learner can have question history, a tracked misconception or an
    // overdue review while the counter still reads zero, and in that case the
    // coach's plan (repair this misconception, these N questions are due) is
    // strictly more useful than a starting-level check. Overriding it would
    // hide real, actionable work.
    const noSignalYet = state.answered === 0
      && Object.keys(state.qstats || {}).length === 0
      && Object.keys(state.misconceptions || {}).length === 0;
    if (noSignalYet && !validTestDate()) {
      /* The baseline owns the WHOLE card, not just its heading.
       *
       * The card is otherwise populated from the generic "coverage"
       * recommendation (12 questions, "Goal: Coverage climbs past 2%",
       * "What's behind it: Coverage", a 206-concept rationale). Rendering that
       * underneath a heading that promises an 8-question starting check made
       * one action report two different question counts and two different
       * durations at once — on the first screen a new learner ever sees.
       *
       * Every field below now describes the baseline that the button actually
       * starts, so the card states one thing: eight questions, about two
       * minutes, and what the learner gets out of them. */
      const baselineN = Core.BASELINE_DEFAULT_N || 8;
      $("planTitle").textContent = "Find your starting level";
      $("planDetail").textContent = "8 quick questions across topics — your results personalize the Today Plan.";
      $("planMeta").textContent = "About 2 minutes · no test date needed";
      planBtn.textContent = `Check my starting level · ${baselineN} questions`;
      planBtn.dataset.action = "baseline";

      const amountEl = $("planAmount");
      if (amountEl) { amountEl.hidden = false; amountEl.textContent = `${baselineN} questions — about 2 minutes`; }
      const noticedEl = $("planNoticed");
      if (noticedEl) {
        noticedEl.hidden = false;
        noticedEl.textContent = "You haven't answered anything yet, so there is no signal to work from yet.";
      }
      const whyEl = $("planWhy");
      if (whyEl) {
        whyEl.hidden = false;
        whyEl.textContent = "One question from a different topic each, so your next plan can target your gaps instead of the whole bank.";
      }
      const goalEl = $("planGoal");
      if (goalEl) { goalEl.hidden = false; goalEl.textContent = "Goal: finish all 8. Your first personal plan follows."; }
      // A baseline is not a diagnosis, so it carries no "what's behind it" label.
      if (kindEl) { kindEl.hidden = true; kindEl.textContent = ""; }
      // The evidence drawer belongs to a diagnosis too — an empty one would
      // just be a control with nothing behind it.
      const evDetails = $("planEvidence");
      if (evDetails) evDetails.hidden = true;
      rationaleEl.hidden = false;
      rationaleEl.replaceChildren(...[
        "A wrong answer here is useful — it is the first evidence of where to start.",
        "You can set a test date later; the plan works without one.",
      ].map((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        return li;
      }));
    }
    // The date picker is a secondary control — the plan's own action stays the
    // single primary button. Shown only while the plan is undated.
    const dateBtn = $("btnPlanDate");
    if (dateBtn) dateBtn.hidden = validTestDate() && plan.status !== "past";
  }

  function render() {
    const { Core, CATEGORIES, getState, catQ, catAccuracy, readiness, icon, startPractice, shuffle } = ctx;
    const state = getState();
    if (!$("view-home")) return;
    renderReadinessPanel();
    const pct = Math.round(readiness() * 100);
    const evidence = hasEvidence(state);
    // Below one percent the rounded number is 0, which a learner who has just
    // answered four questions will read as "this app is broken". Show "<1%" and
    // keep a visible sliver of arc so the ring matches the words.
    $("ringPct").textContent = pct === 0 && evidence ? "<1%" : pct + "%";
    const ring = $("readinessRing");
    if (ring) {
      // role="img" hides the inner text from assistive tech: the label has to
      // carry the number itself or the score is announced as nothing at all.
      ring.setAttribute("aria-label", pct === 0 && evidence
        ? "Study progress: under one percent"
        : `Study progress: ${pct} percent`);
    }
    const C = 2 * Math.PI * 52;
    const fg = $("ringFg");
    fg.style.strokeDasharray = String(C);
    fg.style.strokeDashoffset = String(C * (1 - Math.max(pct, pct === 0 && evidence ? 1 : 0) / 100));
    const acc = state.answered ? Math.round(100 * state.correctCount / state.answered) : null;
    $("stAnswered").textContent = String(state.answered);
    $("stAccuracy").textContent = acc === null ? "–" : `${acc}%`;
    $("stStreak").textContent = String(state.streak.count);
    const best = state.exams.length ? Math.max(...state.exams.map((e) => e.pct)) : null;
    $("stBest").textContent = best === null ? "–" : Math.round(best * 100) + "%";

    renderPlan();

    // The stat strip is noise until there is at least one answered question:
    // "0 answered / – accuracy / 0 streak / – best" tells a new learner
    // nothing, and the readiness panel already says "Not Started" honestly.
    const strip = $("statStrip");
    if (strip) strip.hidden = state.answered === 0;

    // topics
    const grid = $("topicGrid");
    grid.innerHTML = "";
    let attemptedTopics = 0;
    Object.entries(CATEGORIES).forEach(([id, c]) => {
      const qs = catQ(id);
      const m = Math.round(100 * Core.topicMastery(qs, state.qstats));
      const seenCount = qs.filter((q) => state.qstats[q.id]).length;
      if (seenCount > 0) attemptedTopics++;
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

    /* Topic browsing is secondary: it duplicates the Practice screen and, fully
       expanded, it cost 44% of the home screen's height. It is collapsed until
       there is a history worth browsing, then opens by default so returning
       learners get the overview back without a click. */
    const browser = $("topicBrowser");
    if (browser) {
      browser.hidden = false;
      const worthBrowsing = state.answered > 0 && attemptedTopics >= 2;
      browser.open = worthBrowsing;
      const note = $("topicBrowserNote");
      if (note) note.textContent = worthBrowsing
        ? `${attemptedTopics} of ${Object.keys(CATEGORIES).length} attempted`
        : `${Object.keys(CATEGORIES).length} topics`;
    }

    // weak spots
    const weak = Object.entries(CATEGORIES)
      .map(([id, c]) => ({ id, c, acc: catAccuracy(id) }))
      .filter((x) => x.acc !== null && x.acc < 0.8)
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 4);
    /* The badge counts what the list under it shows — weak topics — and stays
       out of the way when there are none. It used to count missed questions,
       so "Weak spots 4" sat above a single row. */
    const weakBadge = $("weakBadge");
    weakBadge.textContent = String(weak.length);
    weakBadge.hidden = weak.length === 0;
    $("weakList").innerHTML = weak.length
      ? weak.map((x) => `<li><span>${icon(x.c.icon, 15)} ${x.c.name}</span><b>${Math.round(x.acc * 100)}%</b></li>`).join("")
      : `<li class="muted">Answer a few questions and your weak topics will appear here.</li>`;
  }

  window.RoadReadyHomeUI = {
    /**
     * @param {{Core, Coach, CATEGORIES, getState, getBank, catQ, catAccuracy,
     *          readiness, icon, startPractice, shuffle,
     *          todayStr, validTestDate, termsForPack, hazardInfoForPack,
     *          hazardScenarioCount, checkProgressAchievements, levelFor,
     *          predictionCalibrationSamples, buildCalibrationCurve,
     *          CALIBRATION_CONTEXT}} deps
     */
    init(deps) { ctx = deps; },
    render, renderPlan, renderReadinessPanel,
  };
})();
