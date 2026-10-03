/* Road Ready — core engine (pure, DOM-free).
   Loaded as a classic script in the browser (window.RoadReadyCore) and
   imported by the test suite (CommonJS export below). No DOM access here. */
"use strict";

(function (root) {
  "use strict";

  /* ---------------- constants ---------------- */
  const SCHEMA_VERSION = 2;
  const DAILY_GOAL = 10;
  const EXAM_SECONDS_PER_QUESTION = 60;
  const MAX_EXAM_HISTORY = 30;

  /* ---------------- state schema ---------------- */
  function defaultSettings() {
    return {
      passMark: 0.8,
      examLen: 20,
      feedback: true,
      theme: "dark",
      tts: false,
      statePack: "generic",
      testDate: "",
    };
  }

  function defaultState() {
    return {
      v: SCHEMA_VERSION,
      qstats: {},        // qid -> {seen, correct, wrong, lastSeen, lastWrong, fastWrong, slowRight, sched:{due, ef, interval, reps}}
      flagged: {},       // qid -> true
      exams: [],         // {date, label, pct, correct, total, pass, durationSec}
      answered: 0,
      correctCount: 0,
      streak: { count: 0, last: "" },
      daily: {},         // date -> answers count (progress statistics history)
      fcKnown: {},       // signId -> true (legacy; signStudy supersedes, kept in sync)
      signStudy: {},     // signId -> {stage, due, reps, lapses, lastSeen} — spaced sign review
      misconceptions: {},// conceptKey -> {errors, questionIds[], firstSeen, lastSeen, stage, solvedIds[], repairedAt}
      coach: { lastSnapshot: null, lastPlanType: "" }, // session-over-session delta for the Adaptive Coach
      coachEvents: [],  // learning-evidence log (js/evidence.js): recommendation outcomes, local only
      fcOrder: null,
      achievements: {},  // id -> unlock timestamp
      xp: 0,
      timeStudied: 0,    // seconds
      hazardBest: 0,
      hazardPct: 0,
      hazardLog: [],     // per-scenario analytics: {scenario, press, band, pts, at}
      outcomes: [],      // retrospective outcome journal (secondary to predictions)
      predictions: [],  // immutable pre-test snapshots, primary calibration dataset
      practical: { log: [] }, // driving-log sessions: {date, minutes, conditions[], roadTypes[], skills{skillId:rating}, notes}
      study: { enrolledAt: undefined, participantId: "", confidence: [], retentionLog: [] },
      rtSamples: [],     // recent answer response times (ms), newest last
      settings: defaultSettings(),
    };
  }

  const num = (v, fallback, min, max) => {
    const n = typeof v === "number" && isFinite(v) ? v : parseFloat(v);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  const bool = (v) => v === true;
  const strEnum = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
  const plainObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- migration / versioning ---------------- */
  // Legacy v1 payloads had no version marker and stored todayDate/todayCount.
  const MIGRATIONS = {
    1: function v1toV2(s) {
      delete s.todayDate;
      delete s.todayCount;
      s.daily = plainObject(s.daily);
      // keep any stored statePack as-is; sanitizeState validates it against
      // the caller-supplied pack ids (a v1 payload may already name a pack)
      s.settings = Object.assign(defaultSettings(), plainObject(s.settings));
      return s;
    },
  };

  /** @param {any} s @param {{packIds?: string[]}} [opts] */
function sanitizeState(s, opts) {
    const packIds = (opts && Array.isArray(opts.packIds) && opts.packIds.length)
      ? opts.packIds : null;
    s.v = SCHEMA_VERSION;
    s.qstats = plainObject(s.qstats);
    Object.keys(s.qstats).forEach((qid) => {
      const st = plainObject(s.qstats[qid]);
      st.seen = num(st.seen, 0, 0, 1e9);
      st.correct = num(st.correct, 0, 0, 1e9);
      st.wrong = num(st.wrong, 0, 0, 1e9);
      st.lastSeen = num(st.lastSeen, 0, 0, 8.64e15) || undefined;
      st.lastWrong = num(st.lastWrong, 0, 0, 8.64e15) || undefined;
      st.fastWrong = num(st.fastWrong, 0, 0, 1e9);
      st.slowRight = num(st.slowRight, 0, 0, 1e9);
      const sc = plainObject(st.sched);
      st.sched = {
        due: num(sc.due, 0, 0, 8.64e15) || undefined,
        ef: num(sc.ef, 2.5, 1.3, 2.8),
        interval: num(sc.interval, 0, 0, 3650),
        reps: num(sc.reps, 0, 0, 1e6),
      };
      s.qstats[qid] = st;
    });
    s.flagged = plainObject(s.flagged);
    s.exams = Array.isArray(s.exams)
      ? s.exams.filter((e) => e && typeof e === "object" && !Array.isArray(e)).slice(-MAX_EXAM_HISTORY).map((e) => ({
      date: num(e.date, Date.now(), 0, 8.64e15),
      label: typeof e.label === "string" ? e.label.slice(0, 80) : "Exam",
      pct: num(e.pct, 0, 0, 1),
      correct: num(e.correct, 0, 0, 1e6),
      total: num(e.total, 0, 1, 1e6),
      pass: bool(e.pass),
      official: bool(e.official),
      durationSec: e.durationSec == null ? undefined : num(e.durationSec, 0, 0, 86400),
      tag: typeof e.tag === "string" ? e.tag.slice(0, 16) : undefined,
    })) : [];
    s.answered = num(s.answered, 0, 0, 1e9);
    s.correctCount = num(s.correctCount, 0, 0, s.answered);
    s.streak = plainObject(s.streak);
    s.streak.count = num(s.streak.count, 0, 0, 36500);
    s.streak.last = typeof s.streak.last === "string" ? s.streak.last : "";
    s.daily = plainObject(s.daily);
    Object.keys(s.daily).forEach((k) => { s.daily[k] = num(s.daily[k], 0, 0, 1e6); });
    s.fcKnown = plainObject(s.fcKnown);
    s.fcOrder = Array.isArray(s.fcOrder) ? s.fcOrder.filter((x) => typeof x === "string") : null;
    s.signStudy = plainObject(s.signStudy);
    Object.keys(s.signStudy).forEach((signId) => {
      const st = plainObject(s.signStudy[signId]);
      const confused = plainObject(st.confused);
      const cleanConfused = {};
      Object.keys(confused).forEach((other) => {
        const count = num(confused[other], 0, 0, 1e6);
        if (count > 0 && typeof other === "string") cleanConfused[other] = count;
      });
      s.signStudy[signId] = {
        stage: strEnum(st.stage, SIGN_STAGES, "new"),
        due: num(st.due, 0, 0, 8.64e15) || undefined,
        reps: num(st.reps, 0, 0, 1e6),
        lapses: num(st.lapses, 0, 0, 1e6),
        lastSeen: num(st.lastSeen, 0, 0, 8.64e15) || undefined,
        confused: cleanConfused,
      };
    });
    // legacy fcKnown flags seed signStudy as mastered so an upgrade never
    // re-drills a learner on signs they already marked as known
    Object.keys(s.fcKnown).forEach((signId) => {
      if (s.fcKnown[signId] && !s.signStudy[signId]) {
        s.signStudy[signId] = { stage: "mastered", due: undefined, reps: 1, lapses: 0, lastSeen: undefined };
      }
    });
    s.misconceptions = plainObject(s.misconceptions);
    Object.keys(s.misconceptions).forEach((key) => {
      const m = plainObject(s.misconceptions[key]);
      s.misconceptions[key] = {
        errors: num(m.errors, 0, 0, 1e6),
        questionIds: Array.isArray(m.questionIds) ? m.questionIds.filter((x) => typeof x === "string").slice(-12) : [],
        firstSeen: num(m.firstSeen, 0, 0, 8.64e15) || undefined,
        lastSeen: num(m.lastSeen, 0, 0, 8.64e15) || undefined,
        stage: num(m.stage, 1, 1, 3),
        solvedIds: Array.isArray(m.solvedIds) ? m.solvedIds.filter((x) => typeof x === "string").slice(-12) : [],
        repairedAt: num(m.repairedAt, 0, 0, 8.64e15) || null,
      };
    });
    const coach = plainObject(s.coach);
    coach.lastSnapshot = coach.lastSnapshot && typeof coach.lastSnapshot === "object" && !Array.isArray(coach.lastSnapshot)
      ? {
          at: num(coach.lastSnapshot.at, 0, 0, 8.64e15) || undefined,
          coveragePct: num(coach.lastSnapshot.coveragePct, 0, 0, 100),
          masteryPct: num(coach.lastSnapshot.masteryPct, 0, 0, 100),
          masteredConcepts: num(coach.lastSnapshot.masteredConcepts, 0, 0, 1e6),
          misconceptionConcepts: num(coach.lastSnapshot.misconceptionConcepts, 0, 0, 1e6),
          overdue: num(coach.lastSnapshot.overdue, 0, 0, 1e6),
          mockPct: coach.lastSnapshot.mockPct == null ? null : num(coach.lastSnapshot.mockPct, 0, 0, 1),
          questionsAnswered: num(coach.lastSnapshot.questionsAnswered, 0, 0, 1e9),
        }
      : null;
    coach.lastPlanType = typeof coach.lastPlanType === "string" ? coach.lastPlanType.slice(0, 32) : "";
    s.coach = coach;
    s.coachEvents = Array.isArray(s.coachEvents)
      ? s.coachEvents.filter((e) => e && typeof e === "object" && !Array.isArray(e)).slice(-200).map((e) => ({
          at: num(e.at, 0, 0, 8.64e15) || undefined,
          type: typeof e.type === "string" ? e.type.slice(0, 32) : "unknown",
          followed: bool(e.followed),
          kind: typeof e.kind === "string" ? e.kind.slice(0, 16) : "practice",
          conceptKeys: Array.isArray(e.conceptKeys) ? e.conceptKeys.filter((k) => typeof k === "string").slice(0, 6) : [],
          before: e.before && typeof e.before === "object" && !Array.isArray(e.before) ? e.before : null,
          during: e.during && typeof e.during === "object" && !Array.isArray(e.during) ? e.during : null,
          after: e.after && typeof e.after === "object" && !Array.isArray(e.after) ? e.after : null,
        }))
      : [];
    s.hazardLog = Array.isArray(s.hazardLog)
      ? s.hazardLog.filter((h) => h && typeof h === "object" && !Array.isArray(h)).slice(-120).map((h) => ({
          scenario: typeof h.scenario === "string" ? h.scenario.slice(0, 80) : "",
          press: h.press == null ? null : num(h.press, 0, 0, 3600),
          band: strEnum(h.band, ["instant", "good", "close", "late", "early"], "late"),
          pts: num(h.pts, 0, 0, 5),
          at: num(h.at, 0, 0, 8.64e15) || undefined,
        }))
      : [];
    s.achievements = plainObject(s.achievements);
    s.xp = num(s.xp, 0, 0, 1e9);
    s.timeStudied = num(s.timeStudied, 0, 0, 1e9);
    s.hazardBest = num(s.hazardBest, 0, 0, 75);
    s.hazardPct = num(s.hazardPct, 0, 0, 1);
    s.rtSamples = Array.isArray(s.rtSamples)
      ? s.rtSamples.filter((x) => typeof x === "number" && isFinite(x) && x >= MIN_RT_MS && x <= MAX_RT_MS)
          .slice(-MAX_RT_SAMPLES)
      : [];
    const practical = Array.isArray(s.practical)
      ? { log: s.practical.filter((x) => x && typeof x === "object" && !Array.isArray(x)) }
      : plainObject(s.practical);
    practical.log = Array.isArray(practical.log)
      ? practical.log.filter((x) => x && typeof x === "object" && !Array.isArray(x))
        .map((x) => ({
          date: num(x.date, Date.now(), 0, 8.64e15),
          minutes: num(x.minutes, 0, 0, 1440),
          conditions: Array.isArray(x.conditions) ? x.conditions.filter((c) => CONDITIONS.includes(c)).slice(0, 8) : [],
          roadTypes: Array.isArray(x.roadTypes) ? x.roadTypes.filter((c) => ROAD_TYPES.includes(c)).slice(0, 8) : [],
          skills: (() => { const sk = plainObject(x.skills); const out = {}; for (const k of Object.keys(sk)) { if (PRACTICAL_RATINGS.includes(sk[k]) && skillIds().includes(k)) out[k] = sk[k]; } return out; })(),
          notes: typeof x.notes === "string" ? x.notes.slice(0, 2000) : "",
        }))
        // a log entry with no rated skills and no duration carries nothing — drop it
        .filter((x) => x.minutes > 0 || Object.keys(x.skills).length > 0)
      : [];
    s.practical = practical;
    const study = plainObject(s.study);
    study.enrolledAt = num(study.enrolledAt, 0, 0, 8.64e15) || undefined;
    study.participantId = typeof study.participantId === "string" ? study.participantId.slice(0, 16) : "";
    study.confidence = Array.isArray(study.confidence)
      ? study.confidence.filter((c) => c && typeof c === "object" && typeof c.catId === "string"
          && Number.isFinite(c.level)).map((c) => ({ catId: c.catId, level: Math.min(5, Math.max(1, Math.round(c.level))) }))
      : [];
    study.retentionLog = Array.isArray(study.retentionLog)
      ? study.retentionLog.filter((o) => o && typeof o === "object" && typeof o.qid === "string").map((o) => ({
          qid: o.qid.slice(0, 24),
          askedAt: num(o.askedAt, Date.now(), 0, 8.64e15),
          right: bool(o.right),
        })) : [];
    s.study = study;
    s.outcomes = Array.isArray(s.outcomes)
      ? s.outcomes.filter((o) => o && typeof o === "object" && !Array.isArray(o)).map((o) => ({
          date: num(o.date, Date.now(), 0, 8.64e15),
          progressPct: num(o.progressPct, 0, 0, 100),
          mockAvgPct: num(o.mockAvgPct, 0, 0, 100),
          questionsSeen: num(o.questionsSeen, 0, 0, 1e6),
          studyMinutes: num(o.studyMinutes, 0, 0, 1e6),
          coveragePct: num(o.coveragePct, 0, 0, 100),
          stabilitySpread: num(o.stabilitySpread, 0, 0, 100),
          diagnosticPct: num(o.diagnosticPct, 0, 0, 100) || undefined,
          jurisdiction: typeof o.jurisdiction === "string" ? o.jurisdiction.slice(0, 8) : undefined,
          readinessEngineVersion: typeof o.readinessEngineVersion === "string" ? o.readinessEngineVersion.slice(0, 48) : undefined,
          result: o.result === "pass" ? "pass" : o.result === "fail" ? "fail" : "unknown",
        })) : [];
    s.predictions = Array.isArray(s.predictions)
      ? s.predictions.filter((p) => p && typeof p === "object" && !Array.isArray(p)).map((p) => ({
          id: typeof p.id === "string" ? p.id.slice(0, 32) : "",
          participantId: typeof p.participantId === "string" ? p.participantId.slice(0, 32) : "",
          jurisdiction: typeof p.jurisdiction === "string" ? p.jurisdiction.slice(0, 8) : "generic",
          intendedTestDate: validIsoDate(p.intendedTestDate) ? p.intendedTestDate : null,
          attemptNumber: num(p.attemptNumber, 1, 1, 1e6),
          predictionCreatedAt: num(p.predictionCreatedAt, Date.now(), 0, 8.64e15),
          readinessPct: num(p.readinessPct, 0, 0, 100),
          mockAvgPct: num(p.mockAvgPct, 0, 0, 100),
          diagnosticPct: num(p.diagnosticPct, 0, 0, 100) || null,
          coveragePct: num(p.coveragePct, 0, 0, 100),
          stabilitySpread: num(p.stabilitySpread, 0, 0, 100) || null,
          questionsSeen: num(p.questionsSeen, 0, 0, 1e6),
          studyMinutes: num(p.studyMinutes, 0, 0, 1e6),
          skillsRated: plainObject(p.skillsRated),
          readinessEngineVersion: typeof p.readinessEngineVersion === "string" ? p.readinessEngineVersion.slice(0, 48) : MASTERY_VERSION,
          scoringVersion: typeof p.scoringVersion === "string" ? p.scoringVersion.slice(0, 48) : SCORING_VERSION,
          protocolVersion: typeof p.protocolVersion === "string" ? p.protocolVersion.slice(0, 48) : PROTOCOL_VERSION,
          contentVersion: typeof p.contentVersion === "string" ? p.contentVersion.slice(0, 96) : "",
          appVersion: typeof p.appVersion === "string" ? p.appVersion.slice(0, 32) : null,
          evidenceClass: strEnum(p.evidenceClass, ["weak", "moderate", "strong"], "weak"),
          outcome: p.outcome && typeof p.outcome === "object" && !Array.isArray(p.outcome) ? {
            result: p.outcome.result === "pass" ? "pass" : p.outcome.result === "fail" ? "fail" : "unknown",
            officialTestDate: validIsoDate(p.outcome.officialTestDate) ? p.outcome.officialTestDate : null,
            recordedAt: num(p.outcome.recordedAt, Date.now(), 0, 8.64e15),
          } : null,
        })) : [];
    s.settings = Object.assign(defaultSettings(), plainObject(s.settings));
    s.settings.passMark = num(s.settings.passMark, 0.8, 0.5, 1);
    s.settings.examLen = num(s.settings.examLen, 20, 5, 100);
    s.settings.feedback = bool(s.settings.feedback);
    s.settings.theme = strEnum(s.settings.theme, ["dark", "light"], "dark");
    s.settings.tts = bool(s.settings.tts);
    // Pack validation: clamp against the supplied whitelist when we can;
    // without one, PRESERVE the stored value — never destroy unverifiable data.
    if (packIds) s.settings.statePack = strEnum(s.settings.statePack, packIds, "generic");
    else if (typeof s.settings.statePack !== "string" || !s.settings.statePack.trim())
      s.settings.statePack = "generic";
    s.settings.testDate = validIsoDate(s.settings.testDate) ? s.settings.testDate : "";
    return s;
  }

  /**
   * Migrate any stored payload (object or JSON string) to the current schema.
   * Never throws; never destroys data it does not understand.
   * @param {any} raw
   * @param {{packIds?: string[]}} [opts] valid state-pack ids (from state-packs.js)
   * @returns {{state: object, fromVersion: number|null, warnings: string[]}}
   */
  function migrateState(raw, opts) {
    let parsed = raw;
    const warnings = [];
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch {
        return { state: defaultState(), fromVersion: null, warnings: ["corrupt-json"] };
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { state: defaultState(), fromVersion: null, warnings: ["invalid-payload"] };
    }
    let from = typeof parsed.v === "number" && parsed.v >= 1 && isFinite(parsed.v) ? Math.floor(parsed.v) : 1;
    let s = clone(parsed);
    while (from < SCHEMA_VERSION) {
      const m = MIGRATIONS[from];
      if (!m) { warnings.push("no-migration-from-" + from); break; }
      s = m(s);
      from++;
    }
    if (from > SCHEMA_VERSION) {
      // Future payload: keep what we can, flag it — do not silently drop user data.
      warnings.push("future-version-" + from);
    }
    return { state: sanitizeState(s, opts), fromVersion: parsed.v || null, warnings };
  }

  /* ---------------- dates / streak / daily goal ---------------- */
  const DAY_MS = 86400000;
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const localDay = (dateLike) => {
    const d = dateLike == null ? new Date() : new Date(dateLike);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const localDayBefore = (dayIso, days) => {
    const [y, m, d] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayIso || "")
      ? [dayIso.slice(0, 4), dayIso.slice(5, 7), dayIso.slice(8, 10)]
      : [null, null, null];
    if (!y) return localDay(new Date(Date.now() - (days || 1) * DAY_MS));
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    dt.setDate(dt.getDate() - (days || 1));
    return localDay(dt);
  };
  const validIsoDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = [Number(value.slice(0, 4)), Number(value.slice(5, 7)), Number(value.slice(8, 10))];
    const parsed = new Date(y, m - 1, d);
    return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
  };
  const daysBetweenLocalDates = (fromIso, toIso) => {
    if (!validIsoDate(fromIso) || !validIsoDate(toIso)) return null;
    const from = new Date(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
    const to = new Date(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
    return Math.round((Number(to) - Number(from)) / DAY_MS);
  };

  /** Pure streak update. Returns {count, last}. */
  function touchStreak(streak, todayIso, yesterdayIso) {
    if (streak.last === todayIso) return streak;
    const count = streak.last === yesterdayIso ? streak.count + 1 : 1;
    return { count, last: todayIso };
  }

  const dailyCount = (daily, dayIso) => (daily && daily[dayIso]) || 0;
  const bumpDaily = (daily, dayIso, n) => {
    const out = Object.assign({}, daily);
    out[dayIso] = (out[dayIso] || 0) + (n || 1);
    return out;
  };

  /** Build a practical daily study plan around a learner's test date. */
  function studyPlan(questions, qstats, exams, daily, testDateIso, todayIso) {
    const today = validIsoDate(todayIso) ? todayIso : localDay(Date.now());
    const todayCount = dailyCount(daily, today);
    if (!validIsoDate(testDateIso)) {
      return { status: "no-date", daysLeft: null, dailyTarget: DAILY_GOAL, todayCount, remainingToday: Math.max(0, DAILY_GOAL - todayCount) };
    }

    const daysLeft = daysBetweenLocalDates(today, testDateIso) == null ? null : Math.max(-1, daysBetweenLocalDates(today, testDateIso));
    const bank = Array.isArray(questions) ? questions : [];
    const stats = plainObject(qstats);
    const unseen = bank.filter((q) => !stats[q.id] || !stats[q.id].seen).length;
    const weak = bank.filter((q) => {
      const st = stats[q.id];
      return st && st.seen && qMastery(st) < 0.65;
    }).length;
    const passedExam = Array.isArray(exams) && exams.some((e) => e && e.pass);
    const workRemaining = unseen + weak * 2;
    const dailyTarget = daysLeft > 0
      ? Math.min(50, Math.max(DAILY_GOAL, Math.ceil(workRemaining / daysLeft)))
      : Math.max(20, DAILY_GOAL);
    const action = daysLeft <= 0 || (daysLeft <= 7 && !passedExam)
      ? "exam" : weak > 0 ? "review" : "practice";

    return {
      status: daysLeft < 0 ? "past" : daysLeft === 0 ? "today" : "active",
      daysLeft, dailyTarget, todayCount,
      remainingToday: Math.max(0, dailyTarget - todayCount),
      unseen, weak, workRemaining, passedExam, action,
    };
  }

  /* ---------------- XP, levels, achievements ---------------- */
  const ACHIEVEMENTS = [
    { id: "first-steps", name: "First Steps",       desc: "Answer 10 questions",                 test: (s) => s.answered >= 10 },
    { id: "century",     name: "Century Club",      desc: "Answer 100 questions",                test: (s) => s.answered >= 100 },
    { id: "perfect",     name: "Perfect Run",       desc: "Score 10/10 in a practice session",   test: (s) => !!s.perfectRun },
    { id: "pass",        name: "Licensed to Learn", desc: "Pass a mock exam",                    test: (s) => s.examsPassed >= 1 },
    { id: "consistent",  name: "Consistent",        desc: "Pass 3 mock exams",                   test: (s) => s.examsPassed >= 3 },
    { id: "streak3",     name: "On Fire",           desc: "Reach a 3-day study streak",          test: (s) => s.streak >= 3 },
    { id: "streak7",     name: "Habit Formed",      desc: "Reach a 7-day study streak",          test: (s) => s.streak >= 7 },
    { id: "signs",       name: "Sign Master",       desc: "Know every sign flashcard",           test: (s) => !!s.allSignsKnown },
    { id: "marathon",    name: "Marathoner",        desc: "Answer 100+ questions in one session",test: (s) => s.sessionAnswers >= 100 },
    { id: "sharp",       name: "Sharpshooter",      desc: "85%+ accuracy across 100+ answers",   test: (s) => s.answered >= 100 && s.accuracy >= 0.85 },
    { id: "hawk",        name: "Hawk Eye",          desc: "Score 70%+ in Hazard Perception",      test: (s) => s.hazardPct >= 0.7 },
    { id: "ready",       name: "Almost There",      desc: "Reach 80% study progress",            test: (s) => s.readinessPct >= 80 },
  ];

  const XP_PER_CORRECT = 10;
  const XP_PER_WRONG = 2;
  const XP_EXAM_PASS = 25;
  const XP_EXAM_PERFECT = 50;
  const XP_PER_HAZARD_POINT = 2;

  function levelFor(xp) {
    let lvl = 1, need = 100, rest = Math.max(0, Math.floor(xp || 0));
    while (rest >= need) { rest -= need; lvl++; need = 100 + (lvl - 1) * 50; }
    return { lvl, into: rest, need };
  }

  const xpForAnswer = (right) => (right ? XP_PER_CORRECT : XP_PER_WRONG);
  const xpForExam = (passed, perfect) => (passed ? (perfect ? XP_EXAM_PERFECT : XP_EXAM_PASS) : 0);

  /** Evaluate which achievement ids are satisfied by a progress snapshot. Pure. */
  function evaluateAchievements(snap) {
    const s = Object.assign({
      answered: 0, accuracy: 0, streak: 0, examsPassed: 0, hazardBest: 0, hazardPct: 0,
      readinessPct: 0, allSignsKnown: false, perfectRun: false, sessionAnswers: 0,
    }, snap);
    return ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id);
  }

  /* ---------------- concept-based mastery hierarchy ---------------- */
  /**
   * Questions are grouped into CONCEPTS — the underlying knowledge unit
   * ("roundabout-priority", "zero-tolerance", …). A question without an
   * explicit concept inherits its topic as a coarse concept, so every
   * question participates in the hierarchy:
   *   concept mastery → topic mastery → overall score.
   */
  const conceptKeyOf = (q) => (q && typeof q.concept === "string" && q.concept.trim())
    ? q.concept.trim()
    : `topic:${q.cat}`;

  /**
   * Mastery of a CONCEPT, not of individual questions.
   *   coverage = fraction of the concept's questions ever attempted
   *   depth    = mean per-question mastery among those attempted
   *   mastery  = coverage × depth
   * Memorising one question of an eight-question concept caps out around
   * 0.125 — real breadth is required to saturate the concept.
   */
  function conceptMastery(conceptQuestions, qstats) {
    const total = conceptQuestions.length;
    if (!total) return 0;
    let seenCount = 0, sum = 0;
    for (const q of conceptQuestions) {
      const st = qstats ? qstats[q.id] : null;
      if (st && st.seen > 0) { seenCount++; sum += qMastery(st); }
    }
    if (!seenCount) return 0;
    return Math.min(1, Math.max(0, (seenCount / total) * (sum / seenCount)));
  }

  /** Group questions by concept key. */
  function groupByConcept(questions) {
    const groups = new Map();
    for (const q of questions) {
      const k = conceptKeyOf(q);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(q);
    }
    return groups;
  }

  /* ---------------- per-question stats: mastery & difficulty ---------------- */
  /** Mastery in [0..1] — 0 unseen .. 1 nailed. */
  function qMastery(stat) {
    if (!stat || !stat.seen) return 0;
    return Math.min(1, Math.max(0, (stat.correct - stat.wrong * 0.5) / Math.max(2, stat.seen * 0.7)));
  }

  /**
   * Empirical difficulty estimate in [0..1] with a neutral 0.4 prior,
   * smoothed so low-observation questions sit near their prior.
   */
  function qDifficulty(stat) {
    const prior = 0.4, k = 4; // pseudo-count weight
    if (!stat || !stat.seen) return prior;
    const observed = stat.wrong / stat.seen;
    return (observed * stat.seen + prior * k) / (stat.seen + k);
  }

  /* ---------------- readiness (v3 algorithm) ---------------- */
  /**
   * Concept-driven hierarchy: concept masteries aggregate into the overall
   * score, weighted by each concept's size and difficulty mix.
   *  - mastery: Σ(conceptMastery × conceptWeight) / Σ(conceptWeight)
   *  - breadth: share of the bank actually encountered
   *  - exams:   average of up to 3 most recent mock-exam scores (when any)
   */
  function readiness(questions, qstats, exams) {
    if (!questions.length) return 0;
    let num = 0, den = 0, seen = 0;
    for (const [, qs] of groupByConcept(questions)) {
      let w = 0;
      for (const q of qs) {
        w += 0.75 + 0.5 * qDifficulty(qstats ? qstats[q.id] : null); // hard questions count more
        const st = qstats && qstats[q.id];
        if (st && st.seen > 0) seen++;
      }
      num += conceptMastery(qs, qstats) * w;
      den += w;
    }
    const masteryC = den ? num / den : 0;
    const breadthC = seen / questions.length;
    let r = 0.65 * masteryC + 0.35 * breadthC;
    const recent = (exams || []).slice(-3);
    if (recent.length) r = r * 0.85 + (recent.reduce((t, e) => t + e.pct, 0) / recent.length) * 0.15;
    return Math.min(1, Math.max(0, r));
  }

  /** Topic mastery aggregates its concepts' masteries, weighted by size. */
  function topicMastery(catQuestions, qstats) {
    if (!catQuestions || !catQuestions.length) return 0;
    let num = 0, den = 0;
    for (const [, qs] of groupByConcept(catQuestions)) {
      num += conceptMastery(qs, qstats) * qs.length;
      den += qs.length;
    }
    return den ? num / den : 0;
  }

  /** Accuracy across a set of questions, or null when nothing attempted. */
  function catAccuracy(catQuestions, qstats) {
    let seen = 0, correct = 0;
    catQuestions.forEach((q) => {
      const st = qstats[q.id];
      if (st) { seen += st.seen; correct += st.correct; }
    });
    return seen ? correct / seen : null;
  }

  /* ---------------- answer fluency (response time) ---------------- */
  /**
   * How fast an answer came is evidence the right/wrong bit alone does not
   * carry. A question answered quickly and *wrongly* is a misconception the
   * learner does not know they hold — the most dangerous kind, and invisible
   * to a plain wrong-count. A question answered slowly and *correctly* is
   * knowledge that exists but is not yet automatic, which is exactly what
   * fails under exam time pressure.
   *
   * Thresholds are the learner's OWN percentiles, never a global constant:
   * read-aloud users, slower readers and phone-vs-desktop all shift the whole
   * distribution, and a fixed "3 seconds is fast" would mislabel every one of
   * them. Below MIN_RT_SAMPLES answers nothing is classified at all.
   */
  const MIN_RT_MS = 250;          // faster than this is a mis-tap, not an answer
  const MAX_RT_MS = 120000;       // slower than this means they walked away
  const MAX_RT_SAMPLES = 300;     // rolling window kept in the save file
  const MIN_RT_SAMPLES = 20;      // below this, no answer is called fast or slow

  /** Clamp one measurement, or null if it is not usable evidence. */
  function normalizeRt(ms) {
    const n = typeof ms === "number" && isFinite(ms) ? ms : NaN;
    if (!isFinite(n) || n < MIN_RT_MS || n > MAX_RT_MS) return null;
    return Math.round(n);
  }

  /** Append a measurement to the rolling window. Returns a new array. */
  function pushRtSample(samples, ms) {
    const v = normalizeRt(ms);
    const base = Array.isArray(samples) ? samples : [];
    if (v == null) return base.slice(-MAX_RT_SAMPLES);
    return base.concat(v).slice(-MAX_RT_SAMPLES);
  }

  /** The learner's own median and upper quartile, or null below the floor. */
  function rtPercentiles(samples) {
    const xs = (Array.isArray(samples) ? samples : [])
      .filter((x) => typeof x === "number" && isFinite(x)).slice().sort((a, b) => a - b);
    if (xs.length < MIN_RT_SAMPLES) return null;
    const at = (p) => xs[Math.min(xs.length - 1, Math.max(0, Math.round((xs.length - 1) * p)))];
    return { n: xs.length, p50: at(0.5), p75: at(0.75) };
  }

  /**
   * Label one answer against the learner's distribution.
   *   fluent            right and quick — secure
   *   effortful-correct right but slow — fragile under time pressure
   *   confident-error   wrong and quick — a misconception, not a gap
   *   known-gap         wrong and slow — uncertainty they can already feel
   * Returns "unclassified" when there is not enough evidence to judge.
   */
  function classifyResponse(rtMs, right, pct) {
    const v = normalizeRt(rtMs);
    if (v == null || !pct) return "unclassified";
    if (right) return v > pct.p75 ? "effortful-correct" : "fluent";
    return v <= pct.p50 ? "confident-error" : "known-gap";
  }

  /**
   * Fold one classified answer into a question's counters. Mutates and
   * returns the stat, matching how reviewSched is used at the call site.
   */
  function applyFluency(stat, label) {
    const st = stat || {};
    if (label === "confident-error") st.fastWrong = (st.fastWrong || 0) + 1;
    if (label === "effortful-correct") st.slowRight = (st.slowRight || 0) + 1;
    return st;
  }

  /**
   * Summary across a bank. `ready` is false until the learner has answered
   * enough questions for their own percentiles to mean anything; the counts
   * are still returned, because a count is a count.
   */
  function answerFluency(questions, qstats, samples) {
    const pct = rtPercentiles(samples);
    const stats = plainObject(qstats);
    const misconceptions = [];
    const fragile = [];
    (questions || []).forEach((q) => {
      const st = stats[q.id];
      if (!st) return;
      if (st.fastWrong > 0) misconceptions.push({ q, count: st.fastWrong });
      else if (st.slowRight > 0) fragile.push({ q, count: st.slowRight });
    });
    misconceptions.sort((a, b) => b.count - a.count);
    fragile.sort((a, b) => b.count - a.count);
    return {
      ready: !!pct,
      samples: pct ? pct.n : (Array.isArray(samples) ? samples.length : 0),
      needed: pct ? 0 : Math.max(0, MIN_RT_SAMPLES - (Array.isArray(samples) ? samples.length : 0)),
      medianMs: pct ? pct.p50 : null,
      slowMs: pct ? pct.p75 : null,
      misconceptions,
      fragile,
    };
  }

  /* ---------------- adaptive selection ---------------- */
  /**
   * Adaptive weight: unseen & previously-missed questions surface more often;
   * scheduled-due questions get a strong boost; flagged ones more again.
   */
  function adaptiveWeights(question, stat, flags, nowMs) {
    const st = stat || { seen: 0, wrong: 0 };
    let w = 1 + st.wrong * 2.5 - qMastery(st) * 0.9;
    w += (st.fastWrong || 0) * 1.5;
    if (!st.seen) w += 1.2;
    if (flags && flags[question.id]) w += 1.5;
    const due = schedDue(st, nowMs == null ? Date.now() : nowMs);
    if (due === "now") w += 2;
    else if (due === "overdue") w += 3;
    return Math.max(0.15, w);
  }

  function buildAdaptivePool(questions, qstats, flags, nowMs) {
    return questions.map((q) => ({
      q,
      w: adaptiveWeights(q, qstats[q.id], flags, nowMs),
    }));
  }

  /** Weighted sampling without replacement. Mutates its copy of the pool only. */
  function pickWeighted(pool, n, rand) {
    const rng = rand || Math.random;
    const p = pool.slice();
    const out = [];
    while (out.length < n && p.length) {
      const total = p.reduce((t, x) => t + x.w, 0);
      if (!(total > 0)) { out.push(...p.splice(0, n - out.length).map((x) => x.q)); break; }
      let r = rng() * total;
      let i = 0;
      for (; i < p.length; i++) { r -= p[i].w; if (r <= 0) break; }
      out.push(p.splice(Math.min(i, p.length - 1), 1)[0].q);
    }
    return out;
  }

  /** Questions previously answered wrong, worst-first; misconceptions first. */
  function missedQuestions(questions, qstats) {
    return questions
      .filter((q) => qstats[q.id] && qstats[q.id].wrong > 0)
      .sort((a, b) => ((qstats[b.id].fastWrong || 0) - (qstats[a.id].fastWrong || 0))
        || (qstats[b.id].wrong - qstats[a.id].wrong)
        || ((qstats[b.id].lastWrong || 0) - (qstats[a.id].lastWrong || 0)));
  }

  /* ---------------- scheduling (weak-topic resurfacing, SM-2-lite) ---------------- */
  function defaultSched() {
    return { due: undefined, ef: 2.5, interval: 0, reps: 0 };
  }

  /**
   * SM-2-inspired update after one review.
   * @param {object} sched previous schedule entry (may be undefined)
   * @param {boolean} right whether the answer was correct
   * @param {number} nowMs current time
   * @param {number} [quality] optional graded recall 0..5 (defaults from `right`)
   * @returns {{due:number, ef:number, interval:number, reps:number}}
   */
  /** @param {any} sched @param {boolean} right @param {number} nowMs @param {number} [quality] */
function reviewSched(sched, right, nowMs, quality) {
    const q = quality == null ? (right ? 4 : 1) : Math.min(5, Math.max(0, quality));
    const prev = sched || defaultSched();
    let { ef, interval, reps } = { ef: prev.ef ?? 2.5, interval: prev.interval ?? 0, reps: prev.reps ?? 0 };
    ef = num(ef, 2.5, 1.3, 2.8);
    if (q < 3) {
      reps = 0;
      interval = 0;
      ef = num(ef - 0.2, 1.3, 1.3, 2.8);
    } else {
      reps = (reps || 0) + 1;
      interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
      interval = Math.min(interval, 180);
      ef = num(ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 1.3, 1.3, 2.8);
    }
    return { due: nowMs + interval * DAY_MS, ef, interval, reps };
  }

  /** "overdue" | "now" | "future" | null (never scheduled). */
  function schedDue(stat, nowMs) {
    const due = stat && stat.sched && stat.sched.due;
    if (!due) return null;
    if (nowMs >= due + DAY_MS) return "overdue";
    if (nowMs >= due) return "now";
    return "future";
  }

  /* ---------------- mock-exam engine ---------------- */
  function shuffle(arr, rand) {
    const rng = rand || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Small deterministic PRNG so "fixed" assessment forms are reproducible. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const timeLimitSecs = (nQuestions) => nQuestions * EXAM_SECONDS_PER_QUESTION;

  /**
   * Grade an exam. Unanswered questions are counted wrong upstream.
   * @returns {{pct:number, pass:boolean, needed:number}}
   */
  function gradeExam(correct, total, passMark) {
    const pct = total > 0 ? correct / total : 0;
    return { pct, pass: pct >= passMark, needed: Math.ceil(passMark * total) };
  }

  /**
   * Blueprint: distribute n seats across topics proportionally to topic size,
   * optionally skewed by editorial `weights` ({cat: multiplier}) — e.g. an
   * official blueprint that emphasizes signs over vehicle maintenance.
   * Largest-remainder so totals match exactly; never allocates more seats
   * than a topic has questions.
   */
  function examBlueprint(bank, n, weights) {
    const w = weights && typeof weights === "object" ? weights : null;
    const counts = {};
    bank.forEach((q) => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
    const cats = Object.keys(counts);
    const total = bank.length;
    // effective weight per topic: base share × multiplier (missing key ⇒ ×1)
    const eff = {};
    let effSum = 0;
    cats.forEach((c) => {
      const m = w && typeof w[c] === "number" && isFinite(w[c]) && w[c] > 0 ? w[c] : 1;
      eff[c] = (counts[c] / total) * m;
      effSum += eff[c];
    });
    const seats = Math.min(n, total);
    const alloc = cats.map((c) => ({
      cat: c,
      avail: counts[c],
      exact: effSum > 0 ? (eff[c] / effSum) * seats : 0,
      take: 0,
    }));
    // pass 1: proportional floor, capped at availability
    alloc.forEach((a) => { a.take = Math.min(Math.floor(a.exact), a.avail); });
    // pass 2: hand out leftover seats by largest remainder
    let left = seats - alloc.reduce((t, x) => t + x.take, 0);
    alloc.sort((a, b) => (b.exact - b.take) - (a.exact - a.take) || (b.avail - a.avail));
    for (let i = 0; left > 0 && alloc.some((a) => a.take < a.avail); i = (i + 1) % alloc.length) {
      if (alloc[i].take < alloc[i].avail) { alloc[i].take++; left--; }
    }
    return alloc.filter((x) => x.take > 0).map((x) => ({ cat: x.cat, take: x.take }));
  }

  /**
   * Return whether a jurisdiction pool can support the blueprint's full
   * official question count using unique questions.
   * @param {Array} bank
   * @param {{questionCount?: number}|null|undefined} blueprint
   */
  function officialExamAvailability(bank, blueprint) {
    const available = Array.isArray(bank) ? bank.length : 0;
    const rawRequired = blueprint && Number.isFinite(blueprint.questionCount)
      ? Math.floor(blueprint.questionCount) : 0;
    const required = Math.max(0, rawRequired);
    return {
      full: required > 0 && available >= required,
      available,
      required,
      missing: Math.max(0, required - available),
    };
  }

  /**
   * Assemble a mock exam.
   * Stratified: honors the topic blueprint so every mock mirrors the real
   * test's topic mix; weakBias reserves ~60% of seats for the 3 weakest topics.
   * @param {{bank: Array, n: number, qstats?: object, weakBias?: boolean, rand?: Function,
   *     nowMs?: number, flags?: object, weights?: object|null,
   *     samplingMode?: "adaptive"|"representative"|"fixed", seed?: number,
   *     recentlySeen?: object, recentWindowMs?: number}} opts
   */
  function assembleExam(opts) {
    const bank = opts.bank, n = Math.min(opts.n, bank.length), qstats = opts.qstats || {};
    // Sampling modes:
    //   adaptive       — practice/weak-topic exams; weights lean toward the
    //                    learner's misses, unseen and due items (uses qstats/flags)
    //   representative — OFFICIAL SIMULATIONS; uniform random within each topic
    //                    stratum. Never inspects qstats, flags or due dates, so
    //                    two learners of equal knowledge get equally hard forms.
    //   fixed          — study diagnostic/post-test; a LOCKED FORM from a seeded
    //                    PRNG so every participant answers identical items.
    const mode = opts.samplingMode === "representative" || opts.samplingMode === "fixed"
      ? opts.samplingMode : "adaptive";
    let rand = opts.rand || Math.random;
    if (mode === "fixed" && !opts.rand) rand = mulberry32(opts.seed == null ? 0x5EED : opts.seed);
    const nowMs = opts.nowMs == null ? Date.now() : opts.nowMs;
    const flags = mode === "adaptive" ? (opts.flags || {}) : {};
    const cats = Array.from(new Set(bank.map((q) => q.cat)));
    const byCat = {};
    cats.forEach((c) => { byCat[c] = bank.filter((q) => q.cat === c); });

    let alloc = examBlueprint(bank, n, opts.weights);

    if (opts.weakBias && mode === "adaptive" && cats.length > 1) {
      const accs = cats.map((c) => ({ c, acc: catAccuracy(byCat[c], qstats) }))
        .sort((a, b) => (a.acc == null ? 1 : a.acc) - (b.acc == null ? 1 : b.acc));
      const weak = accs.slice(0, Math.min(3, cats.length)).map((x) => x.c);
      const weakBank = bank.filter((q) => weak.includes(q.cat));
      const weakSeats = Math.ceil(n * 0.6);
      alloc = examBlueprint(weakBank, Math.min(weakSeats, weakBank.length));
      const restBank = bank.filter((q) => !weak.includes(q.cat));
      const restSeats = n - alloc.reduce((t, x) => t + x.take, 0);
      if (restSeats > 0 && restBank.length) alloc = alloc.concat(examBlueprint(restBank, restSeats));
    }

    const chosen = [];
    // Optional anti-repetition: `recentlySeen` maps question id -> last-seen
    // timestamp (or the qstats map itself). Within a topic stratum, questions
    // seen inside `recentWindowMs` are only used when the stratum has run out
    // of fresh items. Topic weighting is untouched — this only reorders WHICH
    // items a stratum contributes, so consecutive mocks train breadth instead
    // of recognition. Fixed (seeded study) forms ignore it: determinism first.
    const recentWindowMs = opts.recentWindowMs == null ? 72 * 3600 * 1000 : opts.recentWindowMs;
    const lastSeenOf = (id) => {
      if (!opts.recentlySeen || mode === "fixed") return 0;
      const v = opts.recentlySeen[id];
      if (typeof v === "object" && v !== null) return v.lastSeen || 0;
      return typeof v === "number" ? v : 0;
    };
    const isRecent = (q) => {
      const t = lastSeenOf(q.id);
      return t > 0 && nowMs - t < recentWindowMs;
    };
    alloc.forEach(({ cat, take }) => {
      let pool;
      if (mode === "adaptive") {
        pool = buildAdaptivePool(byCat[cat], qstats, flags, nowMs);
      } else {
        // representative/fixed: every item in the stratum is equally likely —
        // learner history is deliberately invisible to the assessment.
        pool = shuffle(byCat[cat], rand).map((q) => ({ q, w: 1 }));
      }
      const want = Math.min(take, pool.length);
      if (opts.recentlySeen && mode !== "fixed" && want > 0) {
        // Fresh items first (pool order already random/weighted); recent ones
        // only top up a stratum that cannot supply enough fresh items.
        const fresh = pool.filter((e) => !isRecent(e.q));
        const stale = pool.filter((e) => isRecent(e.q));
        chosen.push(...pickWeighted(fresh, Math.min(want, fresh.length), rand));
        if (fresh.length < want) {
          chosen.push(...pickWeighted(stale, want - fresh.length, rand));
        }
        return;
      }
      chosen.push(...pickWeighted(pool, want, rand));
    });

    // Top up if some category ran dry.
    if (chosen.length < n) {
      const taken = new Set(chosen.map((q) => q.id));
      const leftovers = shuffle(bank.filter((q) => !taken.has(q.id)), rand);
      chosen.push(...leftovers.slice(0, n - chosen.length));
    }
    return shuffle(chosen.slice(0, n), rand);
  }

  /* ---------------- hazard perception scoring ---------------- */
  /**
   * Score one hazard click. Window [start,end] seconds; clicking earlier than
   * start-0.35 is "too early"; never pressing is "too late".
   * @returns {{pts:number, band:"early"|"instant"|"good"|"close"|"late"}}
   */
  function hazardScore(pressT, winStart, winEnd) {
    const lo = winStart - 0.35;
    if (pressT == null || !(pressT >= 0)) return { pts: 0, band: "late" };
    if (pressT < lo) return { pts: 0, band: "early" };
    const pts = Math.max(1, Math.ceil(5 * (1 - (pressT - lo) / (winEnd - lo))));
    const band = pressT <= winStart + 0.8 ? "instant" : pressT <= (winStart + winEnd) / 2 ? "good" : "close";
    return { pts, band };
  }

  /* ---------------- hazard-perception analytics ---------------- */
  /*
   * One developing hazard per scenario. The analysis records the evidence a
   * learner needs to improve: first USEFUL click (the click that was scored),
   * whether it anticipated early, landed in the developing window, arrived
   * late, whether clicking was excessive, and whether the hazard was missed
   * entirely. Original training material — never DVSA scoring.
   */
  const HAZARD_PRESS_CAP = 5; // beyond this per scenario, clicking is excessive

  /**
   * Analyse one scenario attempt. `presses` is every press timestamp (s),
   * `firstPress` the one that was scored (or null).
   * @returns {{scenario, winStart, winEnd, firstPress, scoredPress, pts, band,
   *            outcome, anticipation, pressCount, excessive, feedback}}
   */
  function hazardAnalysis(scenario, presses, winStart, winEnd) {
    const list = (Array.isArray(presses) ? presses : [])
      .filter((t) => typeof t === "number" && isFinite(t) && t >= 0)
      .sort((a, b) => a - b);
    const scoredPress = list.length ? list[0] : null;
    const r = hazardScore(scoredPress, winStart, winEnd);
    const pressCount = list.length;
    const excessive = pressCount > HAZARD_PRESS_CAP;
    let outcome, anticipation;
    if (scoredPress == null) { outcome = "missed"; anticipation = "none"; }
    else if (r.band === "early") { outcome = "early"; anticipation = "over-eager"; }
    else if (r.band === "late") { outcome = "late"; anticipation = "reactive"; }
    else if (r.band === "instant") { outcome = "window"; anticipation = "anticipatory"; }
    else if (r.band === "good") { outcome = "window"; anticipation = "anticipatory"; }
    else { outcome = "window"; anticipation = "reactive"; }
    return {
      scenario: typeof scenario === "string" ? scenario : "",
      winStart, winEnd,
      firstPress: scoredPress,
      scoredPress,
      pts: r.pts,
      band: r.band,
      outcome, // "window" | "early" | "late" | "missed"
      anticipation,
      pressCount,
      excessive,
      feedback: hazardFeedback(scenario, outcome, anticipation, pressCount, winStart),
    };
  }

  /**
   * Concrete, situation-specific feedback — never a bare score. References the
   * hazard's actual development point so the learner can see the gap between
   * "noticed" and "acted".
   */
  function hazardFeedback(scenario, outcome, anticipation, pressCount, winStart) {
    const name = scenario || "the hazard";
    if (outcome === "missed") return `No click at all — ${name} developed fully without a response. Watch the road edges and the space ahead of parked vehicles.`;
    if (outcome === "early") return `You clicked before ${name} started developing. Early is good, but a reaction to nothing is not anticipation — wait for a movement that threatens your path.`;
    if (outcome === "late") return `You identified ${name}, but only after the situation had already started developing (around ${winStart.toFixed(1)}s). Look one step further ahead next time.`;
    if (anticipation === "anticipatory") return `Good early recognition — you responded as ${name} began to develop.`;
    return `Recognised, but late in the developing window — ${name} was already well under way.`;
  }

  /** Aggregate a run of hazardAnalysis rows into training-level patterns. */
  function hazardSummary(analyses) {
    const rows = (Array.isArray(analyses) ? analyses : []).filter(Boolean);
    const total = rows.length;
    const by = { anticipatory: 0, reactive: 0, "over-eager": 0, none: 0 };
    let pts = 0, missed = 0, early = 0, late = 0, windowHits = 0, excessive = 0;
    for (const a of rows) {
      pts += a.pts || 0;
      if (a.outcome === "missed") missed++;
      if (a.outcome === "early") early++;
      if (a.outcome === "late") late++;
      if (a.outcome === "window") windowHits++;
      if (a.excessive) excessive++;
      if (a.anticipation in by) by[a.anticipation]++;
    }
    return {
      total,
      pts,
      maxPts: total * 5,
      missed, early, late, windowHits, excessive,
      anticipatoryRate: total ? by.anticipatory / total : 0,
      lateRate: total ? late / total : 0,
      // Training-language only: this is not DVSA scoring and must never be
      // presented as an official hazard-perception result.
      verdict: total === 0 ? "no-data"
        : pts / (total * 5) >= 0.75 ? "sharp"
        : pts / (total * 5) >= 0.55 ? "developing"
        : "needs-work",
    };
  }

  /* ---------------- hazard phases & skill categories ---------------- */
  /*
   * Every scenario has four phases:
   *   background — nothing threatening yet; clicking here is a false positive
   *   potential  — early clues visible, nothing directed at your path yet
   *   developing — the situation starts threatening your path
   *   critical   — action required now
   * The win window marks developing→critical. Clicking in "potential" is
   * EARLY anticipation (a trained skill, distinct from a false positive);
   * clicking in "background" is a false positive. Scenarios carry optional
   * `phases: { potential: [start, end] }` so the UI can show the full arc;
   * when absent, potential is the span from 0 to the window start.
   */
  const HAZARD_PHASES = ["background", "potential", "developing", "critical"];

  /** Which phase a click timestamp falls in. */
  function hazardPhaseAt(t, winStart, winEnd, potentialStart) {
    if (t == null || !(t >= 0)) return null;
    const potStart = potentialStart == null ? Math.max(0, winStart - 1.5) : potentialStart;
    if (t >= winEnd) return "critical";
    if (t >= winStart) return "developing";
    if (t >= potStart) return "potential";
    return "background";
  }

  /**
   * Per-scenario timing analysis over every press: first observation,
   * correct anticipation (click inside potential/developing), optimal-window
   * hit, late response, repeated clicking, false-positive clicks (background).
   */
  function hazardTiming(analysis, presses, winStart, winEnd, potentialStart) {
    const list = (Array.isArray(presses) ? presses : []).filter((t) => typeof t === "number" && isFinite(t) && t >= 0).sort((a, b) => a - b);
    const phases = list.map((t) => hazardPhaseAt(t, winStart, winEnd, potentialStart));
    const falsePositives = phases.filter((p) => p === "background").length;
    const anticipatory = phases.some((p) => p === "potential" || p === "developing");
    return {
      scenario: analysis && analysis.scenario,
      firstObservation: list.length ? list[0] : null,
      firstObservationPhase: phases[0] || null,
      anticipatory,
      windowHit: !!(analysis && analysis.outcome === "window" && analysis.scoredPress != null && analysis.scoredPress <= winEnd),
      // "late" is late RECOGNITION: the scored click landed after the window
      // closed (the hazard was already fully under way). A missed hazard has
      // no click at all and is reported separately.
      late: !!(analysis && analysis.scoredPress != null && analysis.scoredPress > winEnd),
      missed: !!(analysis && analysis.outcome === "missed"),
      repeatedClicks: list.length,
      falsePositives,
      earlyClick: !!(analysis && analysis.outcome === "early"),
    };
  }

  /**
   * Hazard skill per category (pedestrians, cyclists, concealed hazards…).
   * Scenarios carry `category`; analyses carry `scenario` (name). The caller
   * passes `categoryOf: name -> category`. Returns category skill rows sorted
   * weakest-first so the Coach can say "concealed hazards are consistently
   * detected late" and recommend scenarios by category.
   */
  function hazardCategorySkill(analyses, categoryOf) {
    const rows = new Map();
    for (const a of analyses || []) {
      if (!a) continue;
      const cat = (typeof categoryOf === "function" ? categoryOf(a.scenario) : null) || "other";
      const r = rows.get(cat) || { category: cat, attempts: 0, pts: 0, max: 0, late: 0, missed: 0, anticipatory: 0 };
      r.attempts++;
      r.pts += a.pts || 0;
      r.max += 5;
      if (a.outcome === "late") r.late++;
      if (a.outcome === "missed") r.missed++;
      if (a.anticipation === "anticipatory") r.anticipatory++;
      rows.set(cat, r);
    }
    return [...rows.values()]
      .map((r) => ({ ...r, rate: r.max ? r.pts / r.max : 0 }))
      .sort((a, b) => (a.rate - b.rate) || (a.category < b.category ? -1 : 1));
  }

  /* ---------------- sign practice & confusion pairs ---------------- */
  /**
   * Sign learning is more than a known bit. Each sign carries a study entry
   * (stage, due, reps, lapses) plus confusion counters: which other signs it
   * gets mixed up with. Confusion pairs drive side-by-side comparison drills.
   */
  function recordSignConfusion(signStudy, a, b, nowMs) {
    const now = nowMs == null ? Date.now() : nowMs;
    const out = Object.assign({}, signStudy || {});
    for (const [from, to] of [[a, b], [b, a]]) {
      if (!from || !to || from === to) continue;
      const prev = out[from] || { stage: "new", reps: 0, lapses: 0 };
      const confused = prev.confused || {};
      confused[to] = (confused[to] || 0) + 1;
      out[from] = Object.assign({}, prev, { confused, lastSeen: now });
    }
    return out;
  }

  /** Signs that have been mixed up, most-confused first. */
  function signConfusionPairs(signStudy) {
    const out = [];
    for (const [id, st] of Object.entries(signStudy || {})) {
      for (const [other, count] of Object.entries((st && st.confused) || {})) {
        if (count > 0) out.push({ a: id, b: other, count });
      }
    }
    // each pair appears twice (a→b, b→a); fold to unordered pairs
    const seen = new Set();
    return out
      .map((p) => {
        const key = [p.a, p.b].sort().join("|");
        return { key, a: p.a, b: p.b, count: p.count };
      })
      .filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)))
      .sort((a, b) => (b.count - a.count) || (a.key < b.key ? -1 : 1))
      .map((p) => ({ a: p.a, b: p.b, count: p.count }));
  }

  /* ---------------- outcome journal (calibration groundwork) ---------------- */
  /**
   * The readiness/progress score is an UNCALIBRATED heuristic. These helpers
   * support opt-in logging of real test outcomes so a future P(pass) model
   * can be fit against observed data.
   */
  const OUTCOME_RESULT_VALUES = ["pass", "fail"];
  /** Re-recording for the same attempt within this window is a double-tap, not a correction. */
  const OUTCOME_DUPLICATE_WINDOW_MS = 60 * 60 * 1000;

  /** Pure append with clamping. */
  function appendOutcome(outcomes, entry, nowMs) {
    const list = Array.isArray(outcomes) ? outcomes.slice() : [];
    list.push({
      date: num(entry && entry.date, nowMs == null ? Date.now() : nowMs, 0, 8.64e15),
      progressPct: num(entry && entry.progressPct, 0, 0, 100),
      mockAvgPct: num(entry && entry.mockAvgPct, 0, 0, 100),
      coveragePct: num(entry && entry.coveragePct, 0, 0, 100),
      stabilitySpread: num(entry && entry.stabilitySpread, 0, 0, 100),
      diagnosticPct: num(entry && entry.diagnosticPct, 0, 0, 100) || undefined,
      jurisdiction: typeof (entry && entry.jurisdiction) === "string" ? entry.jurisdiction.slice(0, 8) : undefined,
      readinessEngineVersion: MASTERY_VERSION,
      questionsSeen: num(entry && entry.questionsSeen, 0, 0, 1e6),
      studyMinutes: num(entry && entry.studyMinutes, 0, 0, 1e6),
      result: OUTCOME_RESULT_VALUES.includes(entry && entry.result) ? entry.result : "unknown",
    });
    return list;
  }

  /** Average pct of the most recent n exams (null when none). */
  function mockAverage(exams, n) {
    const recent = (exams || []).slice(-(n || 3));
    if (!recent.length) return null;
    return recent.reduce((t, e) => t + e.pct, 0) / recent.length;
  }

  /** Bucket label for calibration tables. */
  function progressBucket(progressPct) {
    if (progressPct >= 90) return "90–100%";
    if (progressPct >= 80) return "80–89%";
    if (progressPct >= 70) return "70–79%";
    if (progressPct >= 60) return "60–69%";
    if (progressPct >= 50) return "50–59%";
    return "<50%";
  }

  /* ---------------- practical driving: log, competencies, readiness ---------------- */
  // Ratings per practiced skill in a log session.
  const PRACTICAL_RATINGS = ["good", "ok", "poor"]; // ✓ / △ / ✗
  const RATING_VALUE = { good: 1, ok: 0.5, poor: 0 };

  // Competency groups: each skill logged rolls up into exactly one competency.
  const COMPETENCIES = [
    { id: "observation",         name: "Observation",         skills: ["mirrors", "blind-spots", "scanning-ahead", "signal-timing"] },
    { id: "control",             name: "Vehicle control",     skills: ["steering-smoothness", "speed-control", "braking-smoothness", "pull-away-control"] },
    { id: "junctions",           name: "Junctions",           skills: ["junction-approach-speed", "gap-selection", "turning-position"] },
    { id: "roundabouts",         name: "Roundabouts",         skills: ["roundabout-entry-lane", "yielding-circulating", "roundabout-exit-signal"] },
    { id: "lane-discipline",     name: "Lane discipline",     skills: ["lane-keeping", "curve-positioning", "safe-following-distance"] },
    { id: "parking",             name: "Parking",             skills: ["reverse-parking", "parallel-parking", "hill-parking"] },
    { id: "independent-driving", name: "Independent driving", skills: ["route-following", "decision-confidence", "mistake-recovery"] },
  ];

  const CONDITIONS = ["dry", "wet", "rain", "night", "traffic-heavy", "snow"];
  const ROAD_TYPES = ["residential", "urban", "rural", "highway", "dual-carriageway"];

  const skillIds = () => COMPETENCIES.flatMap((c) => c.skills);
  const competencyName = (id) => (COMPETENCIES.find((c) => c.id === id) || {}).name || id;

  /** Append a validated session (pure). */
  function appendPracticalSession(log, entry, nowMs) {
    const list = Array.isArray(log) ? log.slice() : [];
    const skills = {};
    const raw = (entry && entry.skills) || {};
    for (const k of Object.keys(raw)) {
      if (PRACTICAL_RATINGS.includes(raw[k]) && skillIds().includes(k)) skills[k] = raw[k];
    }
    list.push({
      date: num(entry && entry.date, nowMs == null ? Date.now() : nowMs, 0, 8.64e15),
      minutes: num(entry && entry.minutes, 0, 0, 1440),
      conditions: Array.isArray(entry && entry.conditions) ? entry.conditions.filter((c) => CONDITIONS.includes(c)).slice(0, 8) : [],
      roadTypes: Array.isArray(entry && entry.roadTypes) ? entry.roadTypes.filter((c) => ROAD_TYPES.includes(c)).slice(0, 8) : [],
      skills,
      notes: typeof (entry && entry.notes) === "string" ? entry.notes.slice(0, 2000) : "",
    });
    return list;
  }

  /**
   * Aggregate the log into per-competency scores (0..1) with coverage.
   * score = mean rating across every recorded instance of the competency's
   * skills; coverage = fraction of its skills ever practiced. null = no data.
   */
  function competencyScores(log) {
    const tally = {}; // compId -> {sum, n, skills:Set}
    for (const c of COMPETENCIES) tally[c.id] = { sum: 0, n: 0, skills: new Set() };
    for (const session of log || []) {
      for (const [skillId, rating] of Object.entries(session.skills || {})) {
        const comp = COMPETENCIES.find((c) => c.skills.includes(skillId));
        if (!comp) continue;
        tally[comp.id].sum += RATING_VALUE[rating];
        tally[comp.id].n++;
        tally[comp.id].skills.add(skillId);
      }
    }
    return COMPETENCIES.map((c) => {
      const t = tally[c.id];
      if (!t.n) return { id: c.id, name: c.name, score: null, coverage: 0, skillsPracticed: 0, skillsTotal: c.skills.length };
      return { id: c.id, name: c.name, score: t.sum / t.n, coverage: t.skills.size / c.skills.length, skillsPracticed: t.skills.size, skillsTotal: c.skills.length };
    });
  }

  /** Safely read the practical log from either current or legacy state. */
  function practicalLog(stateLike) {
    const p = stateLike && stateLike.practical;
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.log)) return p.log;
    return [];
  }

  /** Overall practical score: mean of scored competencies × mean coverage. */
  function practicalScore(log) {
    const scores = competencyScores(log).filter((c) => c.score !== null);
    if (!scores.length) return null;
    const avg = scores.reduce((t, c) => t + c.score, 0) / scores.length;
    const coverage = scores.reduce((t, c) => t + c.coverage, 0) / scores.length;
    return Math.min(1, Math.max(0, avg * Math.max(0.5, coverage)));
  }

  /**
   * Combined DRIVING READINESS heuristic (uncalibrated): theory knowledge +
   * practical skill, equally weighted once practical data exists.
   */
  function drivingReadiness(theoryPct, log) {
    const theory = num(theoryPct, 0, 0, 100) / 100;
    const practical = practicalScore(log);
    if (practical === null) return { combined: null, theory, practical: null };
    return { combined: Math.round(((theory + practical) / 2) * 100), theory, practical };
  }

  /** Next lesson focus: lowest-scored competency with data; falls back to
   *  lowest-coverage competency when nothing is scored yet. */
  function nextLessonFocus(log) {
    const scores = competencyScores(log);
    const withData = scores.filter((c) => c.score !== null);
    if (!withData.length) {
      const leastCovered = scores.slice().sort((a, b) => a.coverage - b.coverage)[0];
      return { ...leastCovered, reason: "no sessions logged yet — start with the basics" };
    }
    const worst = withData.slice().sort((a, b) =>
      (a.score - b.score) || (a.coverage - b.coverage))[0];
    const uncovered = scores.find((c) => c.score === null);
    return {
      ...worst,
      reason: uncovered
        ? `weakest at ${Math.round(worst.score * 100)}% — also not yet practiced: ${uncovered.name.toLowerCase()}`
        : `weakest at ${Math.round(worst.score * 100)}%`,
    };
  }

  /**
   * Next PRACTICE SKILL: one single skill to drill next — not seven charts.
   * Aggregates every logged skill rating (mean per skill), returns the
   * lowest-scored practiced skill; with no data, the first unpracticed skill;
   * with nothing logged at all, a starter skill. Pure.
   */
  function nextPracticeSkill(log) {
    const tally = {}; // skillId -> {sum, n}
    for (const session of log || []) {
      for (const [skillId, rating] of Object.entries(session.skills || {})) {
        if (!(skillId in tally)) tally[skillId] = { sum: 0, n: 0 };
        tally[skillId].sum += RATING_VALUE[rating] ?? 0;
        tally[skillId].n++;
      }
    }
    const scored = Object.entries(tally).map(([skillId, t]) => {
      const comp = COMPETENCIES.find((c) => c.skills.includes(skillId));
      return {
        skillId,
        skillName: skillId.replace(/-/g, " "),
        competencyId: comp ? comp.id : "",
        competencyName: comp ? comp.name : "",
        score: t.n ? t.sum / t.n : null,
        practices: t.n,
      };
    });
    if (scored.length) {
      scored.sort((a, b) => (a.score - b.score) || (b.practices - a.practices));
      const worst = scored[0];
      const label = worst.score === null ? "not yet rated" : `${Math.round(worst.score * 100)}%`;
      return { ...worst, reason: `lowest-rated skill at ${label} — drill this one next` };
    }
    return {
      skillId: "mirrors",
      skillName: "mirrors",
      competencyId: "observation",
      competencyName: "Observation",
      score: null,
      practices: 0,
      reason: "no sessions logged yet — start with mirrors",
    };
  }

  /* ---------------- learner study (research instrumentation) ---------------- */
  // Anonymous, opt-in. Everything stays on-device until the user exports.
  // Free-text fields (notes) are deliberately EXCLUDED from study exports.

  const RETENTION_DELAY_DAYS = 7;
  const RETENTION_PROBE_SIZE = 5;

  function createEnrollment(nowMs) {
    // random anonymous id — no account, no PII, stable for the cohort join
    let id = "";
    for (let i = 0; i < 8; i++) id += "0123456789abcdef"[Math.floor(Math.random() * 16)];
    return { participantId: `rr-${id}`, enrolledAt: nowMs == null ? Date.now() : nowMs };
  }

  /** Questions mastered ≥7 days ago → retention probe candidates (oldest first). */
  function retentionProbePool(questions, qstats, retentionLog, nowMs) {
    const asked = new Set((retentionLog || []).map((r) => r.qid));
    const cutoff = nowMs - RETENTION_DELAY_DAYS * DAY_MS;
    return questions
      .filter((q) => {
        const st = qstats[q.id];
        if (!st || st.seen === 0 || asked.has(q.id)) return false;
        const lastSeen = st.lastSeen || 0;
        if (lastSeen > cutoff) return false;                 // too recent
        return st.correct >= 1 && qMastery(st) >= 0.6;       // was actually learned
      })
      .sort((a, b) => ((qstats[a.id].lastSeen || 0) - (qstats[b.id].lastSeen || 0)))
      .slice(0, RETENTION_PROBE_SIZE);
  }

  /**
   * Cohort-grade metric snapshot for one participant.
   *
   * IMPROVEMENT GATE: improvement is measured ONLY when
   *   (a) a diagnostic exists, AND
   *   (b) at least one NON-diagnostic exam was taken AFTER it.
   * A participant with a lone diagnostic has improvement null — never 0 —
   * so they cannot silently enter the cohort's improvement average.
   */
  /** @param {any} stateLike */
  function studyMetrics(stateLike) {
    const topicMastery = (st) => {
      const byCat = {};
      for (const q of st.bank || []) { (byCat[q.cat] ||= []).push(q); }
      return Object.entries(byCat).map(([catId, qs]) => ({
        catId,
        mastery: +topicMasteryOf(qs, st.qstats).toFixed(3),
      }));
    };
    const { enrolledAt, exams, answered, timeStudied, study } = stateLike;
    const all = (exams || []).slice().sort((a, b) => a.date - b.date);
    const baseline = all.find((e) => e.tag === "diagnostic") || null;
    // follow-ups: non-diagnostic exams strictly after the baseline
    const followUps = baseline
      ? all.filter((e) => e !== baseline && e.tag !== "diagnostic" && e.date > baseline.date)
      : [];
    const latest = followUps.length ? followUps[followUps.length - 1] : null;
    const retention = study && Array.isArray(study.retentionLog)
      ? {
          attempts: study.retentionLog.length,
          correct: study.retentionLog.filter((r) => r.right).length,
        }
      : { attempts: 0, correct: 0 };
    return {
      enrolledAt: enrolledAt || null,
      daysSinceEnroll: enrolledAt ? Math.max(0, Math.floor((((stateLike.nowMs == null ? Date.now() : stateLike.nowMs)) - enrolledAt) / DAY_MS)) : null,
      questionsAnswered: answered || 0,
      studyHours: Math.round(((timeStudied || 0) / 3600) * 10) / 10,
      diagnosticPct: baseline ? Math.round(baseline.pct * 100) : null,
      latestMockPct: latest ? Math.round(latest.pct * 100) : null,
      improvementPct: baseline && latest ? Math.round((latest.pct - baseline.pct) * 100) : null,
      mockCount: all.filter((e) => e.tag !== "diagnostic").length,
      confidence: study && Array.isArray(study.confidence) ? study.confidence : [],
      topicMastery: topicMastery(stateLike),
      retentionAttempts: retention.attempts,
      retentionCorrect: retention.correct,
      retentionRate: retention.attempts ? retention.correct / retention.attempts : null,
    };
  }

  /* ---------------- learner study protocol (frozen before recruiting) ---------------- */
  // Changing ANY of these values mid-study contaminates the cohort — a new
  // study must instead bump PROTOCOL_VERSION and start a fresh cohort.
  const PROTOCOL_VERSION = "rr-study-1.0";
  const SCORING_VERSION = "scoring-1";      // gradeExam + XP rules
  const MASTERY_VERSION = "mastery-v3-concepts"; // concept → topic → overall

  /** Cheap deterministic fingerprint of bank size + question ids. */
  function bankFingerprint(bank) {
    const ids = (bank || []).map((q) => q.id).sort().join(",");
    let h = 5381;
    for (let i = 0; i < ids.length; i++) h = ((h * 33) ^ ids.charCodeAt(i)) >>> 0;
    return `${(bank || []).length}-${h.toString(16)}`;
  }


  /**
   * Anonymized export for cohort analysis. Contains ids, numbers and dates —
   * never free-text notes, question content, or anything account-like.
   * Carries the frozen study protocol envelope so mid-study app changes are
   * detectable: cohort analysis groups by protocolVersion.
   * @param {any} stateLike
   * @param {Array} bank
   * @param {number} [exportedAtMs]
   * @param {{appVersion?: string}} [meta]
   */
  function buildStudyExport(stateLike, bank, exportedAtMs, meta) {
    const m = meta || {};
    const metrics = studyMetrics({ ...stateLike, bank });
    return {
      schema: "road-ready-study@2",
      protocol: {
        protocolVersion: PROTOCOL_VERSION,
        contentVersion: bankFingerprint(bank),
        scoringVersion: SCORING_VERSION,
        masteryVersion: MASTERY_VERSION,
        jurisdiction: (stateLike.settings && stateLike.settings.statePack) || "generic",
        appVersion: m.appVersion || null,
      },
      participantId: (stateLike.study && stateLike.study.participantId) || null,
      enrolledAt: (stateLike.study && stateLike.study.enrolledAt) || null,
      exportedAt: new Date(exportedAtMs == null ? Date.now() : exportedAtMs).toISOString(),
      metrics,
      timeline: {
        exams: (stateLike.exams || []).map((e) => ({
          date: e.date, tag: e.tag || "mock", label: e.label || "Exam",
          pct: e.pct, correct: e.correct, total: e.total, pass: !!e.pass,
        })),
        dailyAnswers: clone(stateLike.daily || {}),
        retentionLog: clone((stateLike.study && stateLike.study.retentionLog) || []),
      },
      practicalSessions: (stateLike.practical && Array.isArray(stateLike.practical.log)
        ? stateLike.practical.log.map((s) => ({ date: s.date, minutes: s.minutes, skills: clone(s.skills || {}) }))
        : Array.isArray(stateLike.practical)
          ? stateLike.practical.map((s) => ({ date: s.date, minutes: s.minutes, skills: clone(s.skills || {}) }))
          : []),
      outcomes: (stateLike.outcomes || []).map((o) => ({
        date: o.date, progressPct: o.progressPct, mockAvgPct: o.mockAvgPct,
        questionsSeen: o.questionsSeen, studyMinutes: o.studyMinutes, result: o.result,
      })),
      predictions: (stateLike.predictions || []).map((p) => clone(p)),
    };
  }

  /* ---------------- readiness panel (home) ---------------- */
  /**
   * The road signs a bank's questions actually use.
   *
   * Jurisdiction isolation: the artwork library is shared, but most signs are
   * specific to one country's rules. Deriving the flashcard deck from the
   * questions in the ACTIVE bank means a Great Britain learner is never drilled
   * on US-only artwork (deer crossings, divided-highway beginnings, work-zone
   * flagger signs) and a US learner never sees GB-only signs. Pure function -
   * no DOM, no pack lookups - so it stays testable on its own.
   */
  function signIdsInBank(bank) {
    const ids = new Set();
    for (const q of bank || []) {
      if (!q) continue;
      if (q.signId) ids.add(q.signId);
      if (Array.isArray(q.signIds)) for (const s of q.signIds) if (s) ids.add(s);
    }
    return [...ids].sort();
  }

  /* ---------------- sign flashcards: spaced review stages ---------------- */
  /**
   * Five honest card states instead of a bare known/not-known bit:
   *   new        never studied
   *   learning   seen but still shaky (or lapsed from a later stage)
   *   familiar   answered correctly more than once, review date in the future
   *   mastered   several clean reviews, intervals long
   *   due        any learned card whose spaced-review date has arrived
   * ("due" is computed from stage + due date, never stored — a card cannot be
   * both mastered and not-due in the data.)
   */
  const SIGN_STAGES = ["new", "learning", "familiar", "mastered"];
  const SIGN_INTERVALS = { learning: 1, familiar: 3, mastered: 12 }; // days by stage

  /** Effective stage including the due overlay. Pure. */
  function signStage(entry, nowMs) {
    if (!entry || !entry.stage || entry.stage === "new") return "new";
    const due = entry.due;
    if (due && nowMs != null && nowMs >= due) return "due";
    if (due && nowMs == null && Date.now() >= due) return "due";
    return entry.stage;
  }

  /**
   * Review update after a flip + self-grade. `known` is the learner's honest
   * self-report ("I know it" / "Still learning"): knowing promotes one stage,
   * not knowing lapses to learning and counts a lapse. Deterministic intervals
   * per stage — no randomness in the schedule.
   */
  function reviewSign(entry, known, nowMs) {
    const now = nowMs == null ? Date.now() : nowMs;
    const prev = entry || { stage: "new", reps: 0, lapses: 0 };
    let stage;
    if (!known) {
      stage = "learning";
      return {
        stage,
        due: now + (SIGN_INTERVALS.learning * DAY_MS),
        reps: (prev.reps || 0),
        lapses: (prev.lapses || 0) + 1,
        lastSeen: now,
      };
    }
    const order = ["new", "learning", "familiar", "mastered"];
    const idx = order.indexOf(prev.stage && prev.stage !== "new" ? prev.stage : "new");
    stage = order[Math.min(order.length - 1, idx + 1)];
    return {
      stage,
      due: now + (SIGN_INTERVALS[stage] * DAY_MS),
      reps: (prev.reps || 0) + 1,
      lapses: prev.lapses || 0,
      lastSeen: now,
    };
  }

  /** Due-or-new sign ids first (study order), then the rest. Pure. */
  function signStudyOrder(ids, signStudy, nowMs) {
    const now = nowMs == null ? Date.now() : nowMs;
    const rank = (id) => {
      const s = signStage((signStudy || {})[id], now);
      return s === "new" ? 0 : s === "due" ? 1 : s === "learning" ? 2 : s === "familiar" ? 3 : 4;
    };
    return (ids || []).slice().sort((a, b) => (rank(a) - rank(b)) || (a < b ? -1 : 1));
  }

  /** Count of cards per effective stage — for the flashcard header. Pure. */
  function signStageCounts(ids, signStudy, nowMs) {
    const counts = { new: 0, learning: 0, familiar: 0, mastered: 0, due: 0 };
    for (const id of ids || []) counts[signStage((signStudy || {})[id], nowMs)]++;
    return counts;
  }

  /** Band labels for the combined readiness heuristic. */
  function readinessBand(pct) {
    const p = num(pct, 0, 0, 100);
    /* Bands describe STUDY PROGRESS, never a probability of passing. The engine is
       heuristic and only becomes a measured pass-rate estimate once enough verified
       real-test outcomes exist to calibrate it (see readinessNarrative/calibration),
       so a learner must never be able to read "Ready" as "you will pass". */
    if (p >= 90) return { label: "Strong", tone: "ready" };
    if (p >= 75) return { label: "On Track", tone: "nearly" };
    if (p >= 55) return { label: "Building", tone: "getting" };
    if (p > 0) return { label: "Getting Started", tone: "early" };
    return { label: "Not Started", tone: "early" };
  }

  /**
   * Strong/risk topic lists for the home panel.
   * strong: topics with mastery >= 0.8 (top 2, highest first)
   * risk:   topics with data but mastery < 0.6 (bottom 2, lowest first)
   */
  function strongAndRiskTopics(topicsWithMastery) {
    // topicsWithMastery: [{id,name,mastery(0..1), seen:boolean}]
    const withData = topicsWithMastery.filter((t) => t.seen);
    const strong = withData.filter((t) => t.mastery >= 0.8)
      .sort((a, b) => b.mastery - a.mastery).slice(0, 2);
    const risk = withData.filter((t) => t.mastery < 0.6)
      .sort((a, b) => a.mastery - b.mastery).slice(0, 2);
    return { strong, risk };
  }

  /**
   * Recommended practice count for today.
   * With a test date: spread remaining unmastered questions across the days
   * left (clamped 10..40). Without: the daily goal, +5 per risk topic.
   */
  function recommendedToday({ unmasteredQuestions, daysUntilTest, dailyGoal, riskCount }) {
    const goal = Math.max(5, dailyGoal || DAILY_GOAL);
    if (!unmasteredQuestions || unmasteredQuestions <= 0) return 0;
    if (daysUntilTest != null && daysUntilTest > 0) {
      return Math.min(40, Math.max(10, Math.ceil(unmasteredQuestions / daysUntilTest)));
    }
    const risks = Math.max(0, Math.min(4, riskCount || 0));
    return Math.min(25, goal + risks * 5);
  }

  function dailyStudyRecommendation(opts) {
    const o = opts || {};
    const bank = Array.isArray(o.bank) ? o.bank : [];
    const qstats = plainObject(o.qstats);
    const exams = Array.isArray(o.exams) ? o.exams : [];
    const nowMs = o.nowMs == null ? Date.now() : o.nowMs;
    const today = validIsoDate(o.today) ? o.today : localDay(nowMs);
    const daysLeft = o.daysUntilTest == null && validIsoDate(o.testDate)
      ? daysBetweenLocalDates(today, o.testDate) : o.daysUntilTest;
    const todayCount = num(dailyCount(o.daily, today), 0, 0, 1e6);

    const conceptStats = new Map();
    for (const q of bank) {
      const key = conceptKeyOf(q);
      if (!conceptStats.has(key)) conceptStats.set(key, { questions: [], seen: 0, wrong: 0, due: 0 });
      const c = conceptStats.get(key);
      c.questions.push(q);
      const st = qstats[q.id];
      if (!st || !st.seen) continue;
      c.seen++;
      c.wrong += num(st.wrong, 0, 0, 1e6);
      if (schedDue(st, nowMs) === "now" || schedDue(st, nowMs) === "overdue") c.due++;
    }
    const withMastery = [];
    for (const [concept, c] of conceptStats) {
      const mastery = conceptMastery(c.questions, qstats);
      c.key = concept;
      c.mastery = mastery;
      c.unseen = c.questions.length - c.seen;
      c.risk = (c.seen > 0 && mastery < 0.65) || c.unseen > 0;
      withMastery.push(c);
    }
    const ranked = withMastery
      .filter((c) => c.risk)
      .sort((a, b) => (a.mastery + (a.seen ? 0 : -1)) - (b.mastery + (b.seen ? 0 : -1))
        || b.wrong - a.wrong
        || b.due - a.due
        || b.unseen - a.unseen)
      .slice(0, Math.max(1, Math.min(4, withMastery.length)));

    const reviewDue = bank.filter((q) => {
      const st = qstats[q.id];
      return st && st.seen > 0 && (schedDue(st, nowMs) === "now" || schedDue(st, nowMs) === "overdue");
    }).length;
    const unseenNeeded = ranked.reduce((t, c) => t + Math.min(c.unseen, 2), 0);
    const recentMocks = exams.filter((e) => e && e.tag !== "diagnostic").slice(-2).map((e) => Math.round(e.pct * 100));
    const stability = mockStability(exams, 3);
    const coverage = bankCoverage(bank, qstats);

    let questions;
    let action = "practice";
    if (daysLeft === 0) {
      action = "review";
      questions = Math.min(12, Math.max(4, Math.round((reviewDue || 1) * 0.6)));
    } else if (daysLeft != null && daysLeft > 0 && daysLeft <= 7) {
      const passed = exams.some((e) => e.pass);
      action = passed ? "practice" : "exam";
      questions = Math.max(12, Math.min(35, reviewDue + unseenNeeded + Math.round(coverage * 8)));
      if (action === "exam") questions = Math.max(15, Math.min(40, questions + 10));
    } else {
      const base = Math.max(DAILY_GOAL, reviewDue + unseenNeeded);
      const coveragePressure = coverage < 0.7 ? 8 : coverage < 0.9 ? 4 : 0;
      questions = Math.max(10, Math.min(40, base + coveragePressure));
    }
    questions = Math.max(0, Math.min(questions - todayCount, bank.length));
    if (!questions) action = "practice";

    const focusConcepts = ranked.map((c) => c.key);
    const estimatedMinutes = Math.max(1, Math.round(questions * (action === "exam" ? 0.85 : 0.75)));
    const rationale = [];
    if (ranked[0]) rationale.push(`${ranked[0].key} is your weakest concept`);
    if (reviewDue) rationale.push(`${reviewDue} reviews are due`);
    if (unseenNeeded) rationale.push(`${unseenNeeded} unseen questions are needed`);
    if (recentMocks.length === 2) rationale.push(`your last two mocks were ${recentMocks[0]}% and ${recentMocks[1]}%`);
    if (stability != null && stability > 0.15) rationale.push("recent mock scores are unstable");
    if (daysLeft != null && daysLeft >= 0) rationale.push(`your test is in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`);
    const evidence = [bank.length ? 1 : 0, ranked.length, recentMocks.length, stability != null ? 1 : 0, daysLeft != null ? 1 : 0]
      .reduce((t, x) => t + x, 0);
    return {
      action,
      questions,
      estimatedMinutes,
      focusConcepts,
      reviewDue,
      unseenNeeded,
      rationale,
      confidence: evidence >= 4 ? "high" : evidence >= 3 ? "medium" : "low",
      daysLeft,
      todayCount,
      coveragePct: Math.round(coverage * 100),
    };
  }

  /* ---------------- calibration (outcome → probability) ---------------- */
  // Statistics: Wilson score intervals (no false precision), publication
  // thresholds, jurisdiction-first hierarchy, engine-version isolation,
  // unknown outcomes never counted as fails, duplicates rejected at capture.
  const MIN_BUCKET_N = 8;
  const MAX_INTERVAL_WIDTH = 0.45; // wider than this = "insufficient evidence"
  const CALIBRATION_BUCKETS = ["<50%", "50–59%", "60–69%", "70–79%", "80–89%", "90–100%"];

  /** Wilson score interval for a binomial proportion. */
  function wilsonInterval(passes, n, z) {
    const Z = z ?? 1.96;
    if (!n || n <= 0) return { lo: null, hi: null, width: null };
    const p = passes / n;
    const d = 1 + (Z * Z) / n;
    const centre = (p + (Z * Z) / (2 * n)) / d;
    const half = (Z / d) * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n));
    return {
      lo: Math.max(0, centre - half),
      hi: Math.min(1, centre + half),
      width: Math.min(1, centre + half) - Math.max(0, centre - half),
    };
  }

  /** Per-topic mastery for a state slice (concept-weighted). */
  function topicMasteryOf(qs, qstats) {
    let num = 0, den = 0;
    for (const q of qs) {
      const w = 0.75 + 0.5 * qDifficulty(qstats && qstats[q.id]);
      num += conceptMastery([q], qstats) * w;
      den += w;
    }
    return den ? num / den : 0;
  }

  /** Spread of the most recent n mock scores (null with <2 exams). */
  function mockStability(exams, n) {
    const recent = (exams || []).slice(-(n || 3)).map((e) => e.pct);
    if (recent.length < 2) return null;
    return Math.max(...recent) - Math.min(...recent);
  }

  /** Share of the bank ever attempted (0..1). */
  function bankCoverage(questions, qstats) {
    if (!questions || !questions.length) return 0;
    let seen = 0;
    for (const q of questions) {
      const st = qstats && qstats[q.id];
      if (st && st.seen > 0) seen++;
    }
    return seen / questions.length;
  }

  function bucketFor(pct) {
    return progressBucket(pct);
  }

  /**
   * Calibration curve with uncertainty.
   * Samples: { readinessPct, result:"pass"|"fail"|"unknown", jurisdiction?, engineVersion?, date? }.
   * opts.jurisdiction  — state-first pooling: state outcomes, then same-country
   *                      pooled fallback (labelled), never silent mixing.
   * opts.engineVersion — only samples produced by this engine are counted.
   */
  function calibrationCurve(samples, opts) {
    const minN = (opts && opts.minN) ?? MIN_BUCKET_N;
    const o = opts || {};
    let pool = (samples || []).filter((s) => s && typeof s.readinessPct === "number");
    if (o.engineVersion) pool = pool.filter((s) => s.engineVersion === o.engineVersion);
    let scope = "all";
    if (o.jurisdiction && o.jurisdiction !== "*") {
      const stateRows = pool.filter((s) => s.jurisdiction === o.jurisdiction);
      if (stateRows.length >= minN) {
        pool = stateRows;
        scope = o.jurisdiction;
      } else {
        pool = pool.filter((s) => !s.jurisdiction || s.jurisdiction === "*" || s.jurisdiction === o.jurisdiction);
        scope = "pooled-compatible";
      }
    } else {
      // unknown results stay — counted as pending, never as fails
    }
    return { scope, buckets: CALIBRATION_BUCKETS.map((label) => {
      const inBucket = pool.filter((s) => bucketFor(s.readinessPct) === label);
      const decided = inBucket.filter((s) => s.result === "pass" || s.result === "fail");
      const pending = inBucket.length - decided.length;
      const passes = decided.filter((s) => s.result === "pass").length;
      const iv = wilsonInterval(passes, decided.length);
      const sufficient = decided.length >= minN && iv.width != null && iv.width <= MAX_INTERVAL_WIDTH;
      return {
        bucket: label,
        n: decided.length,
        pending,
        passes,
        passRate: sufficient ? passes / decided.length : null,
        lo: sufficient ? iv.lo : null,
        hi: sufficient ? iv.hi : null,
        width: iv.width,
        sufficient,
      };
    }) };
  }

  /** Curve row matching a readiness percentage. Accepts curve object or raw samples. */
  function calibrationRowFor(curveOrSamples, readinessPct, opts) {
    const builtCurve = Array.isArray(curveOrSamples) && curveOrSamples.length && curveOrSamples[0].buckets
      ? curveOrSamples
      : calibrationCurve(curveOrSamples, opts).buckets;
    return builtCurve.find((row) => row.bucket === progressBucket(readinessPct)) || null;
  }

  /**
   * Honest narrative. Never a bare headline percentage without a defensible
   * interval; never says "chance of passing"; always carries the disclaimer.
   */
  function readinessNarrative(opts) {
    const { readinessPct, curve, riskTopics } = opts || {};
    const spread = Number.isFinite(opts && opts.stabilitySpread) ? opts.stabilitySpread : null;
    const stabilityLine = spread != null && spread > 15
      ? ` Recent representative mock scores are unstable (varying by ${Math.round(spread)} points), so treat this as provisional.`
      : "";
    const DISCLAIMER = "Theory-test readiness is not a claim that you are safe or ready for independent practical driving.";
    const band = readinessBand(readinessPct);

    const builtResult = curve && curve.buckets
      ? { scope: curve.scope || "all", buckets: curve.buckets }
      : calibrationCurve(curve || [], { ...opts });
    const row = builtResult.buckets.find((b) => b.bucket === progressBucket(readinessPct)) || null;

    const riskLine = (riskTopics || []).length
      ? ` Focus areas right now: ${riskTopics.map((r) => r.toLowerCase()).join(",")}.`
      : "";

    const insufficientBecause =
      !row ? "No outcomes recorded for your readiness level yet."
      : row.n === 0 ? "No official-outcome evidence exists for your readiness level yet."
      : row.n < ((opts && opts.minN) ?? MIN_BUCKET_N)
        ? `Only ${row.n} verified outcome${row.n === 1 ? "" : "s"} exist for your readiness level — too few to estimate a pass rate.`
        : `Outcomes exist (${row.n}) but results vary too widely to quote a reliable rate.`;

    if (!row || !row.sufficient) {
      return {
        mode: "insufficient",
        text: `Your study-progress score is ${Math.round(readinessPct)}% (${band.label}). ${insufficientBecause}${stabilityLine}${riskLine}`,
        disclaimer: DISCLAIMER,
        evidence: { n: row ? row.n : 0, pending: row ? row.pending : 0 },
        scope: builtResult.scope,
      };
    }
    const lo = Math.round(row.lo * 100);
    const hi = Math.round(row.hi * 100);
    const scopeLine = builtResult.scope === "pooled-compatible"
      ? "Among pooled learners across states"
      : "Among learners in your jurisdiction";
    return {
      mode: "calibrated",
      calibratedPassRate: row.passRate,
      interval: { lo: row.lo, hi: row.hi },
      evidence: { n: row.n, pending: row.pending },
      scope: builtResult.scope,
      text: `${scopeLine} at ${row.bucket} (${row.n} verified outcomes), observed pass rates were roughly ${lo}–${hi}%.${riskLine}${stabilityLine}`,
      disclaimer: DISCLAIMER,
    };
  }

  /** Self-confidence vs measured mastery per rated topic.
   *  gap > 0 = over-confident; < 0 = under-confident. */
  function confidenceCalibration(confidence, topicsWithMastery) {
    return (confidence || [])
      .map((cv) => {
        const t = (topicsWithMastery || []).find((x) => x.id === cv.catId);
        if (!t || typeof t.mastery !== "number") return null;
        const confidencePct = Math.max(0, Math.min(1, (cv.level - 1) / 4));
        return { catId: cv.catId, confidencePct, masteryPct: t.mastery, gap: +(confidencePct - t.mastery).toFixed(3) };
      })
      .filter(Boolean);
  }

  /* ---------------- official-test predictions (prospective, immutable) ---------------- */
  // A prediction is FROZEN at creation from the learner's then-current state.
  // Attaching an outcome NEVER calls readiness() and never mutates prediction
  // fields. Retrospective journal entries stay in state.outcomes — these are
  // a separate prospective record used for primary calibration.

  function nextAttemptNumber(predictions, participantId) {
    return (predictions || []).filter((p) => p.participantId === participantId).length + 1;
  }

  /**
   * Resolve WHICH pending prediction an official outcome belongs to.
   *
   * A learner can hold several unresolved predictions at once (a date that
   * keeps slipping, a rebook after a cancellation), so "the first unresolved
   * prediction" is not an identity. Matching is explicit and ranked:
   *   1. same jurisdiction   (a CA outcome can never settle a GB prediction)
   *   2. same intended test date, when the outcome carries one
   *   3. earliest unresolved prediction created AFTER the last resolved one —
   *      the next attempt in sequence — falling back to the earliest
   *      unresolved overall for legacy data with no resolved history.
   * Returns null when nothing matches; the caller must NOT invent an
   * attachment for an outcome that does not correspond to a frozen snapshot.
   *
   * Pure. Exported for UI and regression tests.
   */
  function resolveAttemptPrediction(predictions, opts) {
    const o = opts || {};
    const list = (Array.isArray(predictions) ? predictions : []).filter(
      (p) => p && !p.outcome && (p.jurisdiction || "generic") === (o.jurisdiction || "generic")
    );
    if (!list.length) return null;
    if (validIsoDate(o.officialTestDate)) {
      const dated = list.filter((p) => p.intendedTestDate === o.officialTestDate);
      if (dated.length) return dated[0];
    }
    const resolved = (Array.isArray(predictions) ? predictions : []).filter(
      (p) => p && p.outcome && (p.jurisdiction || "generic") === (o.jurisdiction || "generic")
    );
    const lastResolvedAt = resolved.length ? Math.max(...resolved.map((p) => p.predictionCreatedAt)) : null;
    if (lastResolvedAt != null) {
      const afterLast = list.filter((p) => p.predictionCreatedAt > lastResolvedAt);
      if (afterLast.length) return afterLast[0];
    }
    return list[0];
  }

  /** Freeze the current state into an immutable prediction. Pure. */
  function freezePrediction(predictions, participantId, jurisdiction, snapshot, opts) {
    const o = opts || {};
    const intendedTestDate = validIsoDate(o.intendedTestDate) ? o.intendedTestDate : null;
    const coveragePct = num(snapshot.coveragePct, 0, 0, 100);
    const skillsRated = Object.keys(snapshot.skillsRated || {}).length;
    const readinessPct = num(snapshot.readinessPct, 0, 0, 100);
    const mockAvgPct = num(snapshot.mockAvgPct, 0, 0, 100);
    const stabilitySpread = num(snapshot.stabilitySpread, 0, 0, 100);
    const questionsSeen = num(snapshot.questionsSeen, 0, 0, 1e6);
    const studyMinutes = num(snapshot.studyMinutes, 0, 0, 1e6);
    const evidenceClass = coveragePct >= 80 && skillsRated >= 3 && mockAvgPct >= 60 ? "strong"
      : coveragePct >= 50 && questionsSeen >= 20 ? "moderate" : "weak";
    return {
      id: "pred-" + (typeof o.id === "string" && o.id ? o.id.slice(0, 32) : Math.random().toString(16).slice(2, 10)),
      participantId,
      jurisdiction: jurisdiction || "generic",
      intendedTestDate,
      attemptNumber: nextAttemptNumber(predictions, participantId),
      predictionCreatedAt: typeof o.nowMs === "number" ? o.nowMs : Date.now(),
      readinessPct,
      mockAvgPct,
      diagnosticPct: num(snapshot.diagnosticPct, 0, 0, 100) || null,
      coveragePct,
      stabilitySpread: stabilitySpread || null,
      questionsSeen,
      studyMinutes,
      skillsRated: Object.assign({}, snapshot.skillsRated || {}),
      readinessEngineVersion: MASTERY_VERSION,
      scoringVersion: SCORING_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      contentVersion: bankFingerprint(snapshot.bank || []),
      appVersion: typeof (o.appVersion || snapshot.appVersion) === "string" ? (o.appVersion || snapshot.appVersion).slice(0, 32) : null,
      evidenceClass,
      outcome: null, // attached exactly once via attachOutcome()
    };
  }

  /**
   * Attach the official result to an EXISTING prediction.
   * Never calls readiness(); never mutates the input; one outcome per attempt.
   * Corrections re-attach to the SAME prediction (audited replacement).
   */
  function attachOutcome(prediction, result, officialTestDate, recordedAtMs) {
    if (!prediction || prediction.outcome) return prediction;
    if (!["pass", "fail"].includes(result)) return prediction;
    const out = { result, officialTestDate: validIsoDate(officialTestDate) ? officialTestDate : null, recordedAt: nowMs(recordedAtMs) };
    return Object.assign({}, prediction, { outcome: out });
  }

  /**
   * Record an official outcome against the CORRECT pending prediction, or as a
   * standalone retrospective entry when no frozen snapshot matches. Duplicate
   * results for an already-resolved attempt are ignored (idempotent), so a
   * double-tap or an accidental second submit cannot rewrite history.
   *
   * Returns {{ attached: object|null, duplicate: boolean, prediction: object|null }}:
   *   attached  — the prediction object with its outcome set, or null when the
   *               outcome did NOT attach to any frozen prediction (callers must
   *               surface that honestly, never claim one was preserved)
   *   duplicate — true when an identical outcome already existed on the matched
   *               prediction and nothing changed
   *   prediction— the resolved pending prediction, when one existed
   * Pure: inputs are never mutated; returns fresh arrays.
   */
  function recordOfficialOutcome(predictions, outcomes, result, opts) {
    const o = opts || {};
    const now = nowMs(o.nowMs);
    const testDate = validIsoDate(o.officialTestDate) ? o.officialTestDate : null;
    const basePredictions = Array.isArray(predictions) ? predictions.slice() : [];
    const pending = resolveAttemptPrediction(predictions, { jurisdiction: o.jurisdiction, officialTestDate: testDate });
    const journalEntry = () => Object.assign({}, o.snapshot, {
      jurisdiction: o.jurisdiction || (o.snapshot && o.snapshot.jurisdiction),
      date: now,
      result,
    });
    if (!pending) {
      // Duplicate guard: re-recording for the attempt most recently resolved in
      // this jurisdiction (same test date) within a short window is a double-tap
      // or accidental re-submission — a no-op, never a second journal entry and
      // never a rewrite of the frozen outcome. Without this, one official
      // attempt could silently inflate the retrospective pool it later pools
      // with. A deliberate correction (later, or for a different attempt) is
      // still recorded.
      const resolved = (Array.isArray(predictions) ? predictions : [])
        .filter((p) => p && p.outcome && (p.jurisdiction || "generic") === (o.jurisdiction || "generic"))
        .sort((a, b) => b.outcome.recordedAt - a.outcome.recordedAt);
      const last = resolved[0];
      if (last && (last.outcome.officialTestDate || null) === testDate
        && now - last.outcome.recordedAt < OUTCOME_DUPLICATE_WINDOW_MS) {
        return { attached: last, duplicate: true, prediction: last, outcomes: Array.isArray(outcomes) ? outcomes.slice() : [], predictions: basePredictions };
      }
      const nextOutcomes = appendOutcome(outcomes, journalEntry(), now);
      return { attached: null, duplicate: false, prediction: null, outcomes: nextOutcomes, predictions: basePredictions };
    }
    const attached = attachOutcome(pending, result, testDate, now);
    // The returned list must carry the outcome — returning the old object here
    // is how an attachment gets silently lost between record and save.
    const nextPredictions = basePredictions.map((p) => (p === pending ? attached : p));
    const nextOutcomes = appendOutcome(outcomes, journalEntry(), now);
    return { attached, duplicate: false, prediction: pending, outcomes: nextOutcomes, predictions: nextPredictions };
  }
  function nowMs(ms) { return typeof ms === "number" && isFinite(ms) ? ms : Date.now(); }

  /* ---------------- import / export ---------------- */  /* ---------------- import / export ---------------- */
  const EXPORT_APP_ID = "road-ready";

  function exportBundle(state, exportedAtMs) {
    return JSON.stringify({
      app: EXPORT_APP_ID,
      schema: SCHEMA_VERSION,
      exportedAt: new Date(exportedAtMs == null ? Date.now() : exportedAtMs).toISOString(),
      state: clone(state),
    }, null, 2);
  }

  /**
   * Parse + validate an imported bundle. Runs the full migration pipeline so
   * exports from any older app version import cleanly.
   * @returns {{ok:true, state:object, warnings:string[]} | {ok:false, error:string}}
   */
  function parseImport(text, opts) {
    if (typeof text !== "string" || !text.trim()) return { ok: false, error: "empty" };
    let bundle;
    try { bundle = JSON.parse(text); } catch { return { ok: false, error: "not-json" }; }
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) return { ok: false, error: "not-object" };
    if (bundle.app !== EXPORT_APP_ID) return { ok: false, error: "wrong-app" };
    if (typeof bundle.schema !== "number") return { ok: false, error: "missing-schema" };
    if (!bundle.state || typeof bundle.state !== "object" || Array.isArray(bundle.state)) return { ok: false, error: "missing-state" };
    const m = migrateState(bundle.state, opts);
    return { ok: true, state: m.state, warnings: m.warnings.concat(bundle.schema > SCHEMA_VERSION ? ["future-export"] : []) };
  }

  /* ---------------- export surface ---------------- */
  const RoadReadyCore = {
    SCHEMA_VERSION, DAILY_GOAL, EXAM_SECONDS_PER_QUESTION, MAX_EXAM_HISTORY,
    DAY_MS, isoDay, localDay, localDayBefore, daysBetweenLocalDates, validIsoDate, defaultState, defaultSettings, migrateState, sanitizeState,
    touchStreak, dailyCount, bumpDaily, studyPlan,
    ACHIEVEMENTS, levelFor, xpForAnswer, xpForExam, evaluateAchievements,
    XP_PER_CORRECT, XP_PER_WRONG, XP_EXAM_PASS, XP_EXAM_PERFECT, XP_PER_HAZARD_POINT,
    qMastery, qDifficulty, conceptKeyOf, conceptMastery, groupByConcept,
    readiness, topicMastery, catAccuracy,
    adaptiveWeights, buildAdaptivePool, pickWeighted, missedQuestions,
    defaultSched, reviewSched, schedDue,
    shuffle, timeLimitSecs, gradeExam, examBlueprint, assembleExam, officialExamAvailability,
    hazardScore, HAZARD_PRESS_CAP, hazardAnalysis, hazardFeedback, hazardSummary,
    HAZARD_PHASES, hazardPhaseAt, hazardTiming, hazardCategorySkill,
    recordSignConfusion, signConfusionPairs,
    OUTCOME_RESULT_VALUES, appendOutcome, mockAverage, progressBucket,
    PRACTICAL_RATINGS, RATING_VALUE, COMPETENCIES, CONDITIONS, ROAD_TYPES,
    skillIds, competencyName, appendPracticalSession, competencyScores,
    practicalScore, practicalLog, drivingReadiness, nextLessonFocus, nextPracticeSkill,
    RETENTION_DELAY_DAYS, RETENTION_PROBE_SIZE, createEnrollment,
    retentionProbePool, studyMetrics, buildStudyExport,
    PROTOCOL_VERSION, SCORING_VERSION, MASTERY_VERSION, bankFingerprint,
    readinessBand, strongAndRiskTopics, recommendedToday, dailyStudyRecommendation,
    signIdsInBank, SIGN_STAGES, SIGN_INTERVALS, signStage, reviewSign, signStudyOrder, signStageCounts,
    MIN_BUCKET_N, MAX_INTERVAL_WIDTH, CALIBRATION_BUCKETS, mockStability, bankCoverage,
    freezePrediction, attachOutcome, resolveAttemptPrediction, recordOfficialOutcome,
    wilsonInterval, bucketFor, calibrationCurve, calibrationRowFor, readinessNarrative, confidenceCalibration,
    MIN_RT_SAMPLES, MAX_RT_SAMPLES, MIN_RT_MS, MAX_RT_MS,
    normalizeRt, pushRtSample, rtPercentiles, classifyResponse, applyFluency, answerFluency,
    exportBundle, parseImport,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyCore;
  else root.RoadReadyCore = RoadReadyCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
