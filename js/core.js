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
      qstats: {},        // qid -> {seen, correct, wrong, lastSeen, lastWrong, sched:{due, ef, interval, reps}}
      flagged: {},       // qid -> true
      exams: [],         // {date, label, pct, correct, total, pass, durationSec}
      answered: 0,
      correctCount: 0,
      streak: { count: 0, last: "" },
      daily: {},         // date -> answers count (progress statistics history)
      fcKnown: {},       // signId -> true
      fcOrder: null,
      achievements: {},  // id -> unlock timestamp
      xp: 0,
      timeStudied: 0,    // seconds
      hazardBest: 0,
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

  function sanitizeState(s, opts) {
    // Valid pack ids are injected by the caller (app/test supply the real
    // list from state-packs.js); core stays dependency-free with a safe default.
    const packIds = (opts && Array.isArray(opts.packIds) && opts.packIds.length)
      ? opts.packIds : ["generic"];
    s.v = SCHEMA_VERSION;
    s.qstats = plainObject(s.qstats);
    Object.keys(s.qstats).forEach((qid) => {
      const st = plainObject(s.qstats[qid]);
      st.seen = num(st.seen, 0, 0, 1e9);
      st.correct = num(st.correct, 0, 0, 1e9);
      st.wrong = num(st.wrong, 0, 0, 1e9);
      st.lastSeen = num(st.lastSeen, 0, 0, 8.64e15) || undefined;
      st.lastWrong = num(st.lastWrong, 0, 0, 8.64e15) || undefined;
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
      label: typeof e.label === "string" ? e.label : "Exam",
      pct: num(e.pct, 0, 0, 1),
      correct: num(e.correct, 0, 0, 1e6),
      total: num(e.total, 0, 1, 1e6),
      pass: bool(e.pass),
      durationSec: e.durationSec == null ? undefined : num(e.durationSec, 0, 0, 86400),
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
    s.achievements = plainObject(s.achievements);
    s.xp = num(s.xp, 0, 0, 1e9);
    s.timeStudied = num(s.timeStudied, 0, 0, 1e9);
    s.hazardBest = num(s.hazardBest, 0, 0, 30);
    s.settings = Object.assign(defaultSettings(), plainObject(s.settings));
    s.settings.passMark = num(s.settings.passMark, 0.8, 0.5, 1);
    s.settings.examLen = num(s.settings.examLen, 20, 5, 100);
    s.settings.feedback = bool(s.settings.feedback);
    s.settings.theme = strEnum(s.settings.theme, ["dark", "light"], "dark");
    s.settings.tts = bool(s.settings.tts);
    s.settings.statePack = strEnum(s.settings.statePack, packIds, "generic");
    s.settings.testDate = validIsoDate(s.settings.testDate) ? s.settings.testDate : "";
    return s;
  }

  /**
   * Migrate any stored payload (object or JSON string) to the current schema.
   * Never throws; never destroys data it does not understand.
   * @param {object|string} raw
   * @param {{packIds?: string[]}} [opts] valid state-pack ids (from state-packs.js)
   * @returns {{state: object, fromVersion: number|null, warnings: string[]}}
   */
  function migrateState(raw, opts) {
    let parsed = raw;
    const warnings = [];
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch (e) {
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
  const validIsoDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = Date.parse(value + "T00:00:00Z");
    return isFinite(parsed) && isoDay(parsed) === value;
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
    const today = validIsoDate(todayIso) ? todayIso : isoDay(Date.now());
    const todayCount = dailyCount(daily, today);
    if (!validIsoDate(testDateIso)) {
      return { status: "no-date", daysLeft: null, dailyTarget: DAILY_GOAL, todayCount, remainingToday: Math.max(0, DAILY_GOAL - todayCount) };
    }

    const daysLeft = Math.round((Date.parse(testDateIso + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / DAY_MS);
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
    { id: "hawk",        name: "Hawk Eye",          desc: "Score 24+ in Hazard Perception",      test: (s) => s.hazardBest >= 24 },
    { id: "ready",       name: "Test Ready",        desc: "Reach 80% readiness",                 test: (s) => s.readinessPct >= 80 },
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
      answered: 0, accuracy: 0, streak: 0, examsPassed: 0, hazardBest: 0,
      readinessPct: 0, allSignsKnown: false, perfectRun: false, sessionAnswers: 0,
    }, snap);
    return ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id);
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

  /* ---------------- readiness (v2 algorithm) ---------------- */
  /**
   * Weighted blend of three signals:
   *  - mastery: per-question mastery weighted toward harder questions
   *  - breadth: share of the bank actually encountered
   *  - exams:   average of up to 3 most recent mock-exam scores (when any)
   */
  function readiness(questions, qstats, exams) {
    if (!questions.length) return 0;
    let num = 0, den = 0, seen = 0;
    questions.forEach((q) => {
      const st = qstats[q.id];
      const w = 0.75 + 0.5 * qDifficulty(st);   // hard questions count more
      num += qMastery(st) * w;
      den += w;
      if (st && st.seen > 0) seen++;
    });
    const masteryC = den ? num / den : 0;
    const breadthC = seen / questions.length;
    let r = 0.65 * masteryC + 0.35 * breadthC;
    const recent = (exams || []).slice(-3);
    if (recent.length) r = r * 0.85 + (recent.reduce((t, e) => t + e.pct, 0) / recent.length) * 0.15;
    return Math.min(1, Math.max(0, r));
  }

  function topicMastery(catQuestions, qstats) {
    if (!catQuestions.length) return 0;
    return catQuestions.reduce((t, q) => t + qMastery(qstats[q.id]), 0) / catQuestions.length;
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

  /* ---------------- adaptive selection ---------------- */
  /**
   * Adaptive weight: unseen & previously-missed questions surface more often;
   * scheduled-due questions get a strong boost; flagged ones more again.
   */
  function adaptiveWeights(question, stat, flags, nowMs) {
    const st = stat || { seen: 0, wrong: 0 };
    let w = 1 + st.wrong * 2.5 - qMastery(st) * 0.9;
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

  /** Questions previously answered wrong, worst-first. */
  function missedQuestions(questions, qstats) {
    return questions
      .filter((q) => qstats[q.id] && qstats[q.id].wrong > 0)
      .sort((a, b) => (qstats[b.id].wrong - qstats[a.id].wrong)
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
  function reviewSched(sched, right, nowMs, quality) {
    const q = quality == null ? (right ? 4 : 1) : Math.min(5, Math.max(0, quality));
    const prev = sched || defaultSched();
    let { ef, interval, reps } = prev;
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
   * Assemble a mock exam.
   * @param {object} opts {bank, n, qstats, weakBias, rand, nowMs, flags}
   * Stratified: honors the topic blueprint so every mock mirrors the real
   * test's topic mix; weakBias reserves ~60% of seats for the 3 weakest topics.
   */
  function assembleExam(opts) {
    const bank = opts.bank, n = Math.min(opts.n, bank.length), qstats = opts.qstats;
    const rand = opts.rand || Math.random;
    const nowMs = opts.nowMs == null ? Date.now() : opts.nowMs;
    const flags = opts.flags || {};
    const cats = Array.from(new Set(bank.map((q) => q.cat)));
    const byCat = {};
    cats.forEach((c) => { byCat[c] = bank.filter((q) => q.cat === c); });

    let alloc = examBlueprint(bank, n, opts.weights);

    if (opts.weakBias && cats.length > 1) {
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
    alloc.forEach(({ cat, take }) => {
      const pool = buildAdaptivePool(byCat[cat], qstats, flags, nowMs);
      chosen.push(...pickWeighted(pool, Math.min(take, pool.length), rand));
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

  /* ---------------- import / export ---------------- */
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
    try { bundle = JSON.parse(text); } catch (e) { return { ok: false, error: "not-json" }; }
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
    DAY_MS, isoDay, validIsoDate, defaultState, defaultSettings, migrateState, sanitizeState,
    touchStreak, dailyCount, bumpDaily, studyPlan,
    ACHIEVEMENTS, levelFor, xpForAnswer, xpForExam, evaluateAchievements,
    XP_PER_CORRECT, XP_PER_WRONG, XP_EXAM_PASS, XP_EXAM_PERFECT, XP_PER_HAZARD_POINT,
    qMastery, qDifficulty, readiness, topicMastery, catAccuracy,
    adaptiveWeights, buildAdaptivePool, pickWeighted, missedQuestions,
    defaultSched, reviewSched, schedDue,
    shuffle, timeLimitSecs, gradeExam, examBlueprint, assembleExam,
    hazardScore,
    exportBundle, parseImport,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyCore;
  else root.RoadReadyCore = RoadReadyCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
