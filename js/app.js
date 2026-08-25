/* Road Ready — app logic */
"use strict";

const Core = window.RoadReadyCore;
const Packs = window.RoadReadyPacks;
const BLUEPRINTS = (window.RoadReadyBlueprints || {}).EXAM_BLUEPRINTS || {};
const Jur = window.RoadReadyJurisdictions || {};
const COUNTRY = Jur.JURISDICTIONS ? Jur.JURISDICTIONS[Jur.ACTIVE_COUNTRY] : null;
const TERMS = (COUNTRY && COUNTRY.terminology) || { agencyShort: "DMV", examName: "knowledge test", learnerPermit: "learner's permit" };
const APP_VERSION = "1.1.0";
const HAZARD_INFO = (COUNTRY && COUNTRY.hazardPerception) || { includedInExam: false, positioning: "bonus training" };
const STORE_KEY = "roadready.v1";
/** @returns {any} element by id — vanilla app, DOM types vary per caller */
const $ = (id) => document.getElementById(id);
const qsa = /** @returns {NodeListOf<HTMLElement>} */(sel) => document.querySelectorAll(sel);
const on = (el, ev, fn) => el.addEventListener(ev, fn);

/* ---------------- state ---------------- */
let storageOk = true;
try { localStorage.setItem("roadready.probe", "1"); localStorage.removeItem("roadready.probe"); }
catch (e) { storageOk = false; }
const memStore = {};
const rawGet = (k) => storageOk ? localStorage.getItem(k) : (memStore[k] ?? null);
const rawSet = (k, v) => { if (storageOk) localStorage.setItem(k, v); else memStore[k] = v; };

let state = loadState();

function loadState() {
  let parsed;
  try {
    const raw = rawGet(STORE_KEY);
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  const m = Core.migrateState(parsed, { packIds: Packs.PACK_IDS });
  m.warnings.forEach((w) => console.warn("[road-ready] state:", w));
  return m.state;
}
function save() {
  try { rawSet(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}
const todayStr = () => new Date().toISOString().slice(0, 10);

function touchStreak() {
  const t = todayStr();
  const y = new Date(Date.now() - Core.DAY_MS).toISOString().slice(0, 10);
  state.streak = Core.touchStreak(state.streak, t, y);
}
function todayAnswered() {
  return Core.dailyCount(state.daily, todayStr());
}

/* ---------------- import / export ---------------- */
function exportProgress() {
  const blob = new Blob([Core.exportBundle(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `road-ready-progress-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const r = Core.parseImport(String(reader.result || ""), { packIds: Packs.PACK_IDS });
    if (!r.ok) { alert("That file doesn't look like a Road Ready backup (" + r.error + ")."); return; }
    if (!confirm(r.warnings.length
      ? "This backup is from another app version (" + r.warnings.join(", ") + "). Import anyway?"
      : "Replace current progress with this backup?")) return;
    state = r.state;
    bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
    save();
    renderStateFacts();
    renderHome(); renderStats(); renderFlashcards();
    toast("Progress imported", "Your history is back.", "download");
  };
  reader.readAsText(file);
}

/* ---------------- XP, levels & achievements ---------------- */
const ACHIEVEMENTS = Core.ACHIEVEMENTS;
function levelFor(xp) { return Core.levelFor(xp); }
function toast(title, sub, ic) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.innerHTML = `${icon(ic || "award", 17)}<div><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  host.appendChild(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3700);
}
function unlock(id) {
  if (state.achievements[id]) return;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  state.achievements[id] = Date.now();
  save();
  toast("Achievement: " + a.name, a.desc, "award");
}
function addXP(n) {
  const before = levelFor(state.xp).lvl;
  state.xp += n;
  const after = levelFor(state.xp);
  save();
  if (after.lvl > before) toast("Level " + after.lvl + " reached", "Keep going — you're building real muscle memory.", "sparkles");
}
/* Build the pure progress snapshot the achievement evaluator consumes. */
function achievementSnapshot(sessionAnswers) {
  return {
    answered: state.answered,
    accuracy: state.answered ? state.correctCount / state.answered : 0,
    streak: state.streak.count,
    examsPassed: state.exams.filter(e => e.pass).length,
    hazardBest: state.hazardBest,
    readinessPct: Math.round(readiness() * 100),
    allSignsKnown: Object.keys(SIGNS).every(id => state.fcKnown[id]),
    perfectRun: !!(session && session.perfectRun),
    sessionAnswers: sessionAnswers != null ? sessionAnswers : (session && session.answers ? session.answers.length : 0),
  };
}
function checkProgressAchievements() {
  const have = state.achievements;
  Core.evaluateAchievements(achievementSnapshot()).forEach(id => unlock(id));
  void have;
}

/* ---------------- read-aloud (TTS) ---------------- */
function ttsSupported() {
  return typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
}
function applyTTS() {
  const b = $("btnTTS");
  b.hidden = !ttsSupported();
  b.classList.toggle("on", !!state.settings.tts);
  b.innerHTML = `${icon(state.settings.tts ? "volume" : "volume-off", 13)} Read ${state.settings.tts ? "on" : "off"}`;
}
function speak(text) {
  if (!state.settings.tts || !ttsSupported() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable — silently ignore */ }
}
function stopSpeaking() {
  if (ttsSupported()) { try { speechSynthesis.cancel(); } catch (e) {} }
}

/* ---------------- study time tracking ---------------- */
let ttTick = 0;
setInterval(() => {
  const v = document.querySelector(".view.active");
  if (!v) return;
  if (["view-quiz", "view-flashcards", "view-review", "view-hazard"].includes(v.id)) {
    state.timeStudied = (state.timeStudied || 0) + 1;
    if (++ttTick % 20 === 0) save();
  }
}, 1000);
function fmtTime(s) {
  if (!s) return "0m";
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? h + "h " + m + "m" : m + "m";
}

/* ---------------- helpers ---------------- */
const ALL_QUESTIONS = QUESTIONS.concat(Packs.allPackQuestions());
let bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
const byId = {};
ALL_QUESTIONS.forEach(q => byId[q.id] = q);
const catQ = (cat) => bank.filter(q => q.cat === cat);
const shuffle = (arr) => Core.shuffle(arr);

/* mastery: 0 (unseen) .. 1 (nailed) */
const qMastery = (q) => Core.qMastery(state.qstats[q.id]);
const readiness = () => Core.readiness(bank, state.qstats, state.exams);
const missedQuestions = () => Core.missedQuestions(bank, state.qstats);
const catAccuracy = (cat) => Core.catAccuracy(catQ(cat), state.qstats);

/* adaptive pool: unseen & previously-missed questions surface more often;
   scheduled-due ones most of all (weak-topic scheduling) */
const adaptivePool = () => Core.buildAdaptivePool(bank, state.qstats, state.flagged);
const pickWeighted = (pool, n) => Core.pickWeighted(pool, n);

/* ---------------- router ---------------- */
let quizBackTarget = "home";

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const v = $("view-" + name);
  if (v) v.classList.add("active");
  if (name !== "quiz") stopSpeaking();
  $("btnBack").hidden = !(name === "quiz" || name === "setup" || name === "results");
  /** @type {NodeListOf<HTMLElement>} */(/** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#bottomNav button"))).forEach(b =>
    b.classList.toggle("active", b.dataset.nav === name || (b.dataset.nav === "practice" && name === "quiz" && quizBackTarget !== "home") ));
  window.scrollTo(0, 0);
}


/* ---------------- readiness panel (home) ---------------- */
let rpCalNarrative = null;
function renderReadinessPanel() {
  const host = $("readinessPanel");
  if (!host) return;
  host.hidden = false;
  const theoryPct = Math.round(readiness() * 100);
  const log = Array.isArray(state.practical) ? (state.practical.log || []) : [];
  const dr = Core.drivingReadiness(theoryPct, log);
  const pct = dr.combined === null ? theoryPct : dr.combined;

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
  // calibrated sentence (only speaks once pooled outcomes exist)
  const samples = (state.outcomes || []).map((o) => ({ readinessPct: o.progressPct, result: o.result }));
  const spreadPts = (() => { const sp = Core.mockStability(state.exams, 3); return sp == null ? null : Math.round(sp * 100); })();
  rpCalNarrative = Core.readinessNarrative({ readinessPct: theoryPct, curve: Core.calibrationCurve(samples), riskTopics: risk.map((t) => t.name), stabilitySpread: spreadPts });

  // unmastered count + days until test date (if set)
  const unmastered = topics.reduce((t, tp) => {
    const qs = catQ(tp.id);
    return t + qs.filter((q) => !state.qstats[q.id] || Core.qMastery(state.qstats[q.id]) < 0.8).length;
  }, 0);
  let daysLeft = null;
  if (state.settings.testDate) {
    const diff = Math.ceil((Date.parse(state.settings.testDate + "T12:00:00Z") - Date.now()) / Core.DAY_MS);
    if (diff > 0) daysLeft = diff;
  }
  const rec = Core.recommendedToday({ unmasteredQuestions: unmastered, daysUntilTest: daysLeft, dailyGoal: Core.DAILY_GOAL, riskCount: risk.length });

  const calEl = $("rpCalLine");
  if (calEl) {
    calEl.hidden = rpCalNarrative.mode !== "calibrated";
    if (!calEl.hidden) calEl.textContent = rpCalNarrative.text;
  }
  $("rpBand").textContent = pct <= 0 && !topics.some((t) => t.seen) ? "Not Started" : Core.readinessBand(pct).label;

  const items = [];
  strong.forEach((t) => items.push(`<li class="rp-strong"><span class="rp-glyph">✓</span> Strong: ${t.name.toLowerCase()}</li>`));
  risk.forEach((t) => items.push(`<li class="rp-risk"><span class="rp-glyph">△</span> Risk: ${t.name.toLowerCase()}</li>`));
  if (!items.length) items.push('<li class="muted">Answer a few questions and your strong/risk areas will appear here.</li>');
  if (rec > 0) items.push(`<li class="rp-rec">Recommended today: <b>${rec} questions</b>${daysLeft ? ` (test in ${daysLeft} day${daysLeft === 1 ? "" : "s"})` : ""}</li>`);
  else items.push('<li class="rp-rec"><b>Bank mastered</b> — keep sharp with mock exams.</li>');
  $("rpList").innerHTML = items.join("");

  // Start today's set: adaptive mix weighted toward risk topics, sized to rec
  on($("rpStart"), "click", () => {
    const n = Math.max(5, Math.min(rec || Core.DAILY_GOAL, bank.length));
    const qs = pickWeighted(adaptivePool(), n);
    if (qs.length) startPractice(qs, "Today's Set", "home");
  });
}

/* ---------------- HOME ---------------- */
function renderHome() {
  renderReadinessPanel();
  const pct = Math.round(readiness() * 100);
  $("ringPct").textContent = pct + "%";
  const C = 2 * Math.PI * 52;
  const fg = $("ringFg");
  fg.style.strokeDasharray = C;
  fg.style.strokeDashoffset = C * (1 - pct / 100);
  const acc = state.answered ? Math.round(100 * state.correctCount / state.answered) : null;
  $("stAnswered").textContent = String(state.answered);
  $("stAccuracy").textContent = acc === null ? "–" : `${acc}%`;
  $("stStreak").textContent = state.streak.count;
  const best = state.exams.length ? Math.max(...state.exams.map(e => e.pct)) : null;
  $("stBest").textContent = best === null ? "–" : Math.round(best * 100) + "%";

  const passedMock = state.exams.some(e => e.pass);
  $("heroSub").textContent = state.answered === 0
    ? `Study a little every day and walk into your ${TERMS.agencyShort} with confidence.`
    : passedMock
      ? "You've passed a practice mock exam — keep drilling to stay sharp."
      : "Keep going — review your weak spots and drill the questions you missed.";

  // level chip + hazard best + achievement checks
  const lv = levelFor(state.xp);
  $("heroLvl").textContent = state.answered ? `Level ${lv.lvl} · ${state.xp} XP` : "";
  const hazardTag = HAZARD_INFO.includedInExam
    ? "part of your exam"
    : "bonus training — not part of most U.S. knowledge exams";
  $("hazardBestLabel").textContent = state.hazardBest
    ? `Best score: ${state.hazardBest}/30 — ${hazardTag}`
    : `Spot developing hazards early (${hazardTag})`;
  checkProgressAchievements();

  // daily goal + test-date study plan
  const plan = Core.studyPlan(bank, state.qstats, state.exams, state.daily, state.settings.testDate, todayStr());
  const t = plan.todayCount;
  const target = plan.dailyTarget;
  const goalEl = $("dailyGoal");
  /** @type {HTMLElement} */(goalEl.querySelector(".dg-bar-fill")).style.width = Math.min(100, 100 * t / target) + "%";
  goalEl.querySelector(".dg-label").innerHTML = t >= target
    ? `Daily goal complete — <b>${t}</b> answered today`
    : `Today's goal: <b>${t}/${target}</b> questions answered`;

  const planBtn = $("btnPlanAction");
  if (plan.status === "no-date") {
    $("planTitle").textContent = "Turn practice into a plan";
    $("planDetail").textContent = "Add your test date and Road Ready will calculate what to study each day.";
    $("planMeta").textContent = "Private · offline · adjustable anytime";
    planBtn.textContent = "Set test date";
    planBtn.dataset.action = "set-date";
  } else if (plan.status === "past") {
    $("planTitle").textContent = "Update your test date";
    $("planDetail").textContent = "Your saved test date has passed. Choose a new date to rebuild the plan.";
    $("planMeta").textContent = "Your progress is still here";
    planBtn.textContent = "Choose a date";
    planBtn.dataset.action = "set-date";
  } else {
    const dayLabel = plan.daysLeft === 0 ? "Test day is today" : `${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"} to test day`;
    $("planTitle").textContent = dayLabel;
    $("planDetail").textContent = plan.remainingToday
      ? `${plan.remainingToday} more question${plan.remainingToday === 1 ? "" : "s"} today keeps you on pace.`
      : "Today's target is complete. Keep the momentum or take a mock exam.";
    $("planMeta").textContent = `${plan.unseen} unseen · ${plan.weak} weak · ${plan.dailyTarget}/day`;
    planBtn.dataset.action = plan.action;
    planBtn.textContent = plan.action === "exam" ? "Take mock exam"
      : plan.action === "review" ? "Review weak spots" : "Start today's practice";
  }

  // topics
  const grid = $("topicGrid");
  grid.innerHTML = "";
  Object.entries(CATEGORIES).forEach(([id, c]) => {
    const qs = catQ(id);
    const m = Math.round(100 * Core.topicMastery(qs, state.qstats));
    const seenCount = qs.filter(q => state.qstats[q.id]).length;
    const b = document.createElement("button");
    b.className = "card topic-card";
    b.innerHTML = `<div class="topic-head"><span class="topic-ico">${icon(c.icon, 19)}</span>
      <div><div class="topic-name">${c.name}</div><div class="topic-desc">${c.desc}</div></div>
      <span class="topic-count">${seenCount}/${qs.length}</span></div>
      <div class="bar"><div class="bar-fill" style="width:${m}%"></div></div>
      <div class="topic-foot"><span>${m}% mastery</span><span class="link">Practice ${icon("chevron-right", 12)}</span></div>`;
    on(b, "click", () => startPractice(shuffle(catQ(id)).slice(0, 10), c.name, "home"));
    grid.appendChild(b);
  });

  // weak spots
  const weak = Object.entries(CATEGORIES)
    .map(([id, c]) => ({ id, c, acc: catAccuracy(id) }))
    .filter(x => x.acc !== null && x.acc < 0.8)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 4);
  $("weakBadge").textContent = missedQuestions().length;
  $("weakList").innerHTML = weak.length
    ? weak.map(x => `<li><span>${icon(x.c.icon, 15)} ${x.c.name}</span><b>${Math.round(x.acc * 100)}%</b></li>`).join("")
    : `<li class="muted">Answer a few questions and your weak topics will appear here.</li>`;
}

/* ---------------- SETUP ---------------- */
function startSetup(mode, focusCat) {
  quizBackTarget = "home";
  $("setupTitle").textContent = mode === "practice" ? "Practice" : "Mock Exam";
  $("setupSub").textContent = mode === "practice" ? "Pick a topic — or drill smart with adaptive mix." : `Timed ${TERMS.agencyShort}-style ${TERMS.examName} — real exam conditions, no feedback until the end.`;
  const list = $("setupList");
  list.innerHTML = "";
  if (mode === "practice") {
    const items = [
      { id: "adaptive", icon: "sparkles", name: "Adaptive Mix", desc: `Prioritizes your weak spots across all ${bank.length} questions`, action: () => startPractice(pickWeighted(adaptivePool(), 10), "Adaptive Mix", "home") },
      { id: "marathon", icon: "infinity", name: "Marathon — Full Bank", desc: `All ${bank.length} questions in one run — anything you miss comes back. Quit anytime`, action: () => startPractice(shuffle(bank).slice(), "Marathon", "home", true) },
      { id: "missed", icon: "target", name: "Missed Questions", desc: missedQuestions().length ? `Re-drill the ${Math.min(10, missedQuestions().length)} you've gotten wrong` : "Nothing missed yet — nice!", action: () => { const m = missedQuestions(); if (m.length) startPractice(pickWeighted(m.map(q => ({ q, w: 1 })), Math.min(10, m.length)), "Missed Questions", "home"); } },
      { id: "flagged", icon: "flag", name: "Flagged Questions", desc: Object.keys(state.flagged).length ? `${Object.keys(state.flagged).length} flagged for review` : "Flag questions during practice to build this set", action: () => { const f = Object.keys(state.flagged).map(id => byId[id]).filter(Boolean); if (f.length) startPractice(shuffle(f).slice(0, 15), "Flagged Questions", "home"); } },
    ];
    const stateQuestions = bank.filter(q => Array.isArray(q.jurisdiction) && q.jurisdiction.includes(state.settings.statePack));
    if (stateQuestions.length) {
      const pack = Packs.STATE_PACKS[state.settings.statePack];
      items.splice(1, 0, {
        id: "state-rules", icon: "scale", name: `${pack.name} State Rules`,
        desc: `${stateQuestions.length} jurisdiction-specific questions · every answer cites the official handbook`,
        action: () => startPractice(shuffle(stateQuestions), `${pack.name} State Rules`, "home"),
      });
    }
    Object.entries(CATEGORIES).forEach(([id, c]) => {
      items.push({
        id, icon: c.icon, name: c.name, desc: c.desc,
        action: () => startPractice(shuffle(catQ(id)).slice(0, 10), c.name, "home"),
      });
    });
    items.forEach(it => list.appendChild(setupRow(it)));
  } else {
    const items = [];
    // Official Simulation: locked to the selected jurisdiction's real exam
    const packId = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
    const bp = BLUEPRINTS[packId];
    if (bp) {
      items.push({
        id: "official", icon: "grad", name: bp.label,
        desc: `${bp.questionCount} questions · pass ${bp.minCorrect}/${bp.questionCount} (official threshold) · ${bp.timeLimitMin ? bp.timeLimitMin + "-min limit" : "standard pacing"} · feedback at end`,
        action: () => startOfficialExam(packId),
      });
    }
    items.push(
      { id: "std", icon: "clipboard", name: `Standard Exam — ${state.settings.examLen} questions`, desc: `Pass mark ${Math.round(state.settings.passMark * 100)}% · ${state.settings.examLen} min time limit`, action: () => startExam(state.settings.examLen) },
      { id: "quick", icon: "zap", name: "Quick Check — 10 questions", desc: "5-minute diagnostic across all topics", action: () => startExam(10) },
      { id: "full", icon: "grad", name: "Full Test — 46 questions", desc: "Simulates many states' full knowledge test · 46 min", action: () => startExam(46) },
      { id: "weak", icon: "target", name: "Weak Topics Exam", desc: "20 questions weighted toward your lowest categories", action: () => startExam(20, true) },
    );
    items.forEach(it => list.appendChild(setupRow(it)));
    if (!bp) {
      const note = document.createElement("p");
      note.className = "setting-note";
      note.textContent = "Pick your state in Settings → \"Your state's rules\" to unlock the Official Simulation of that state's real knowledge exam.";
      list.appendChild(note);
    } else {
      const notes = document.createElement("p");
      notes.className = "setting-note";
      notes.textContent = bp.notes;
      list.appendChild(notes);
    }
  }
  showView("setup");
}
function setupRow(it) {
  const b = document.createElement("button");
  b.className = "setup-row card";
  b.innerHTML = `<span class="setup-ico">${icon(it.icon, 19)}</span><div><div class="setup-name">${it.name}</div><div class="setup-desc">${it.desc}</div></div><span class="chev">${icon("chevron-right", 16)}</span>`;
  on(b, "click", it.action);
  return b;
}

/* ---------------- QUIZ ENGINE ---------------- */
let session = null;

function startPractice(questions, label, backTo, marathon) {
  if (!questions.length) return;
  quizBackTarget = backTo || "home";
  session = { mode: "practice", label, questions, i: 0, correct: 0, answers: [], endTs: 0, timerId: null, marathon: !!marathon, requeued: {} };
  beginQuiz();
}
function startExam(n, weakBias) {
  quizBackTarget = "home";
  // Blueprint-stratified assembly: every mock mirrors the real test's topic
  // mix; weakBias reserves ~60% of seats for your three weakest topics.
  const qs = Core.assembleExam({ bank, n, qstats: state.qstats, flags: state.flagged, weakBias, samplingMode: "adaptive" });
  session = { mode: "exam", label: n >= 40 ? "Full Test" : n > 12 ? "Mock Exam" : "Quick Check", questions: qs, i: 0, correct: 0, answers: [], timeLeft: Core.timeLimitSecs(qs.length), endTs: 0, timerId: null };
  beginQuiz();
}

/* Official Simulation — locked to the jurisdiction's real exam parameters.
   Pool: universal + this state's questions only. Feedback stays hidden until
   the end; pass bar and pacing come from EXAM_BLUEPRINTS, not settings. */
function startOfficialExam(packId) {
  const bp = BLUEPRINTS[packId];
  if (!bp) return;
  quizBackTarget = "home";
  const qs = Core.assembleExam({ bank, n: bp.questionCount, samplingMode: "representative", weights: bp.topicWeights });
  session = {
    mode: "exam", official: true, blueprint: bp,
    label: bp.label,
    questions: qs, i: 0, correct: 0, answers: [],
    timeLeft: bp.timeLimitMin ? bp.timeLimitMin * 60 : Core.timeLimitSecs(qs.length),
    endTs: 0, timerId: null,
  };
  beginQuiz();
}
function beginQuiz() {
  $("qTimer").hidden = session.mode !== "exam";
  $("btnFlag").hidden = false;
  $("btnQuit").textContent = session.mode === "exam" ? "Submit" : "End";
  if (session.mode === "exam") {
    clearInterval(session.timerId);
    session.timerId = setInterval(tickTimer, 1000);
    renderTimer();
  }
  renderQuiz();
  showView("quiz");
}
function tickTimer() {
  session.timeLeft--;
  renderTimer();
  if (session.timeLeft <= 0) finishSession(true);
}
function renderTimer() {
  const m = Math.floor(session.timeLeft / 60), s = session.timeLeft % 60;
  $("qTimer").innerHTML = `${icon("clock", 13)} ${m}:${String(s).padStart(2, "0")}`;
  $("qTimer").classList.toggle("urgent", session.timeLeft < 60);
}
function renderQuiz() {
  const q = session.questions[session.i];
  const total = session.questions.length;
  $("qprogBar").style.width = (100 * session.i / total) + "%";
  $("qCounter").textContent = `Q ${session.i + 1}/${total}`;
  $("qCategory").textContent = CATEGORIES[q.cat].name;
  // question forms: single sign, sign combination, ASCII road-layout scene, and photo placeholder
  const signIds = Array.isArray(q.signIds) && q.signIds.length ? q.signIds : (q.signId ? [q.signId] : []);
  $("signFrame").hidden = !signIds.length;
  if (signIds.length) {
    $("signFrame").innerHTML = signIds.length > 1
      ? `<div class="sign-row">${signIds.map(id => signSVG(id, 104)).join("")}</div>`
      : signSVG(signIds[0], 150);
  }
  const sceneHost = $("qScene");
  if (q.scene) {
    const isPhoto = q.form === "photo";
    const label = isPhoto ? "photograph — described scene" : "road layout diagram";
    const photoHead = isPhoto ? `<div class="photo-badge">${icon("camera", 12)} PHOTO — imagine this view</div>` : "";
    sceneHost.hidden = false;
    sceneHost.innerHTML = `${photoHead}<pre class="scene${isPhoto ? " photo-scene" : ""}" aria-label="${label}">${escapeHTML(q.scene)}</pre>`;
  } else {
    sceneHost.hidden = true;
    sceneHost.innerHTML = "";
  }
  $("qText").textContent = q.q;

  const box = $("choices");
  box.innerHTML = "";
  const order = shuffle(q.choices.map((_, idx) => idx));
  session.order = order;
  order.forEach((origIdx, disp) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.innerHTML = `<span class="choice-key">${disp + 1}</span><span class="choice-text">${escapeHTML(q.choices[origIdx])}</span><span class="choice-mark"></span>`;
    on(b, "click", () => answer(origIdx, b));
    box.appendChild(b);
  });
  $("feedback").hidden = true;
  $("fbSource").hidden = true;
  $("fbSource").removeAttribute("href");
  $("btnNext").disabled = true;
  $("btnNext").textContent = session.i + 1 >= total ? "Finish" : "Next";
  const hint = document.querySelector(".kbd-hint");
  if (hint) hint.innerHTML = session.mode === "exam"
    ? `Tip: press <kbd>1</kbd>–<kbd>4</kbd> to answer — it advances automatically`
    : `Tip: press <kbd>1</kbd>–<kbd>4</kbd> to answer, <kbd>Enter</kbd> for next`;
  updateFlagBtn();
  speak(q.q + ". " + q.choices.map((c, i) => (i + 1) + ". " + c).join(" "));
}
function escapeHTML(s) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function sourceCitationHTML(q) {
  const source = Packs.sourceForQuestion(q);
  if (!source) return "";
  const detail = q.sourceSection ? `${source.agency} · ${q.sourceSection}` : source.title;
  // composite sources cite many documents and may have no single URL
  if (!source.url) return `<span class="source-link">Official source: ${escapeHTML(detail)}</span>`;
  return `<a class="source-link" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">Official source: ${escapeHTML(detail)} ↗</a>`;
}

function answer(origIdx, btnEl) {
  if (session.answeredCurrent) return;
  session.answeredCurrent = true;
  const q = session.questions[session.i];
  const right = origIdx === q.a;
  session.answers.push({ qid: q.id, picked: origIdx, right });

  if (session.mode === "practice") {
    markChoiceButtons(q);
    const fb = $("feedback");
    fb.hidden = !state.settings.feedback;
    $("fbHead").innerHTML = right ? `<span class="ok">${icon("check", 15)} Correct</span>` : `<span class="bad">${icon("x", 15)} Not quite</span>`;
    $("fbWhy").textContent = q.why;
    const source = Packs.sourceForQuestion(q);
    const sourceLink = $("fbSource");
    sourceLink.hidden = !source;
    if (source) {
      sourceLink.href = source.url;
      sourceLink.textContent = `Official source: ${source.agency} · ${q.sourceSection} ↗`;
      sourceLink.setAttribute("aria-label", `Open ${source.title}, section ${q.sourceSection}, in a new tab`);
    } else {
      sourceLink.removeAttribute("href");
      sourceLink.removeAttribute("aria-label");
    }
    btnEl && btnEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("btnNext").disabled = false;
    $("btnNext").focus();
    speak((right ? "Correct. " : "Not quite. ") + q.why);
    // marathon: missed questions come back once
    if (session.marathon && !right && !session.requeued[q.id]) {
      session.requeued[q.id] = true;
      session.questions.push(q);
    }
  } else {
    // exam: brief visual acknowledge, then auto-advance
    $("btnNext").disabled = true;
    const btns = document.querySelectorAll("#choices .choice");
    /** @type {NodeListOf<HTMLButtonElement>} */(btns).forEach(b => (b.disabled = true));
    session.advanceId = setTimeout(() => {
      session.answeredCurrent = false;
      session.i++;
      if (session.i >= session.questions.length) finishSession();
      else renderQuiz();
    }, 420);
  }
  recordAnswer(q, right);
}
function markChoiceButtons(q) {
  const btns = /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#choices .choice"));
  btns.forEach((b, disp) => {
    const orig = session.order[disp];
    const picked = b === document.activeElement || b.classList.contains("picked");
    /** @type {HTMLButtonElement} */(b).disabled = true;
    if (orig === q.a) {
      b.classList.add("correct");
      b.querySelector(".choice-mark").innerHTML = icon("check", 16);
    } else if (picked) {
      b.classList.add("wrong");
      b.querySelector(".choice-mark").innerHTML = icon("x", 16);
    }
  });
}
function recordAnswer(q, right) {
  const now = Date.now();
  const s = state.qstats[q.id] || (state.qstats[q.id] = { seen: 0, correct: 0, wrong: 0 });
  s.seen++; right ? s.correct++ : s.wrong++;
  s.lastSeen = now;
  if (!right) s.lastWrong = now;
  s.sched = Core.reviewSched(s.sched, right, now);   // weak-topic resurfacing
  state.answered++; if (right) state.correctCount++;
  state.daily = Core.bumpDaily(state.daily, todayStr());
  touchStreak();
  addXP(Core.xpForAnswer(right));
  checkProgressAchievements();
  save();
}
function nextQuestion() {
  if (!session.answeredCurrent) return;
  session.answeredCurrent = false;
  session.i++;
  if (session.i >= session.questions.length) finishSession();
  else renderQuiz();
}
function finishSession(timedOut) {
  if (session.finished) return;
  session.finished = true;
  clearInterval(session.timerId);
  clearTimeout(session.advanceId);
  if (session.mode === "exam") {
    // unanswered questions count as wrong
    session.questions.forEach(q => {
      if (!session.answers.some(a => a.qid === q.id)) session.answers.push({ qid: q.id, picked: -1, right: false });
    });
    const total = session.questions.length;
    const correct = session.answers.filter(a => a.right).length;
    // official simulations grade on the jurisdiction's real pass bar
    const bp = session.official ? session.blueprint : null;
    const passMark = bp ? bp.minCorrect / Math.max(1, bp.questionCount) : state.settings.passMark;
    const g = Core.gradeExam(correct, total, passMark);
    const pass = g.pass && (!bp || total === Math.min(bp.questionCount, bank.length));
    state.exams.push({ date: Date.now(), label: session.label, pct: g.pct, correct, total, pass, durationSec: Core.timeLimitSecs(total) - Math.max(0, session.timeLeft || 0), official: !!bp, tag: session.tag || undefined });
    if (state.exams.length > Core.MAX_EXAM_HISTORY) state.exams = state.exams.slice(-Core.MAX_EXAM_HISTORY);
    save();
    checkProgressAchievements();
    if (pass) {
      unlock("pass");
      addXP(Core.xpForExam(true, correct === total));
    }
    showResults({
      pass, correct, total, timedOut,
      answers: session.answers,
      title: pass ? (bp ? "Passed — Official Standard" : "Passed") : "Not yet",
      sub: pass
        ? bp
          ? `You met ${bp.label.replace(" Simulation", "")}'s real bar: ${bp.minCorrect} of ${bp.questionCount}. ${bp.notes}`
          : `You scored above the ${Math.round(state.settings.passMark * 100)}% pass mark. Take another exam to build consistency.`
        : bp
          ? `The real ${bp.label.replace(" Simulation", "")} requires ${bp.minCorrect} of ${total}. Review your misses and try again.`
          : `You need ${g.needed} of ${total} to pass. Review your misses and try again — most people pass on a retake.`,
    });
  } else {
    // practice: score only the questions actually answered
    const total = session.answers.length;
    if (!total) { showView(quizBackTarget || "home"); return; }
    const correct = session.answers.filter(a => a.right).length;
    const early = total < session.questions.length;
    session.perfectRun = correct === total && total >= 10;
    // memory-check answers feed the retention metric
    if (session.tag === "retention" && session.answers.length) {
      state.study.retentionLog = (state.study.retentionLog || []).concat(
        session.answers.map(a => ({ qid: a.qid, askedAt: Date.now(), right: a.right })));
    }
    if (session.perfectRun) { unlock("perfect"); addXP(20); }
    showResults({
      pass: correct / total >= 0.8, correct, total, timedOut,
      answers: session.answers,
      title: "Session complete",
      sub: `${correct} of ${total} correct.${early ? " (Ended early.)" : ""} ${correct === total ? "Perfect run." : "Review the explanations below."}`,
    });
  }
  stopSpeaking();
}
function updateFlagBtn() {
  const q = session.questions[session.i];
  const f = !!state.flagged[q.id];
  $("btnFlag").classList.toggle("flagged", f);
  $("btnFlag").innerHTML = `${icon("flag", 13)} ${f ? "Flagged" : "Flag"}`;
}
function toggleFlag() {
  if (!session) return;
  const q = session.questions[session.i];
  if (state.flagged[q.id]) delete state.flagged[q.id];
  else state.flagged[q.id] = true;
  save();
  updateFlagBtn();
}

/* ---------------- RESULTS ---------------- */
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
function showResults(r) {
  $("resultEmoji").innerHTML = icon(r.pass ? "trophy" : "x-circle", 54);
  $("resultTitle").textContent = r.title;
  $("resultScore").textContent = Math.round(100 * r.correct / r.total) + "%";
  $("resultScore").className = "score-big " + (r.pass ? "pass" : "fail");
  $("resultSub").textContent = (r.timedOut ? "Time ran out — your unanswered questions were counted. " : "") + r.sub;

  const grid = $("resultGrid");
  grid.innerHTML = "";
  const byCat = {};
  r.answers.forEach(a => {
    const q = byId[a.qid];
    (byCat[q.cat] = byCat[q.cat] || []).push(a);
  });
  Object.entries(byCat).forEach(([cat, arr]) => {
    const ok = arr.filter(a => a.right).length;
    const div = document.createElement("div");
    div.className = "result-cat " + (ok === arr.length ? "good" : ok / arr.length >= 0.5 ? "mid" : "bad");
    div.innerHTML = `${icon(CATEGORIES[cat].icon, 14)} <span>${CATEGORIES[cat].name}</span><b>${ok}/${arr.length}</b>`;
    grid.appendChild(div);
  });

  const missed = r.answers.filter(a => !a.right);
  const list = $("reviewList");
  list.innerHTML = missed.length
    ? missed.map(a => {
        const q = byId[a.qid];
        return `<div class="review-item card">
          ${q.signId ? `<div class="sign-frame small">${signSVG(q.signId, 70)}</div>` : ""}
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
  session.lastMissed = missed.map(a => a.qid);
  showView("results");
  if (r.pass && session.mode === "exam") confetti();
}

/* ---------------- FLASHCARDS ---------------- */
let fcIndex = 0;
function fcIds() {
  const ids = Object.keys(SIGNS);
  if (state.fcOrder && state.fcOrder.length === ids.length &&
      state.fcOrder.every(id => SIGNS[id])) return state.fcOrder;
  return ids;
}
function renderFlashcards() {
  const ids = fcIds();
  fcIndex = Math.min(fcIndex, ids.length - 1);
  const id = ids[fcIndex];
  const s = SIGNS[id];
  $("fcSign").innerHTML = signSVG(id, 200);
  $("fcName").textContent = s.name;
  $("fcMeaning").textContent = s.meaning;
  $("fcCounter").textContent = `${fcIndex + 1} / ${ids.length}`;
  const known = Object.keys(state.fcKnown).filter(k => SIGNS[k]).length;
  $("fcKnownPill").innerHTML = `${icon("check", 13)} ${known}/${ids.length} known`;
  const card = $("flashcard");
  card.classList.remove("flipped");
  card.classList.toggle("known", !!state.fcKnown[id]);
  $("btnFcYes").innerHTML = `${icon("check", 16)} ${state.fcKnown[id] ? "Known" : "I Know It"}`;
}
function flipCard() { $("flashcard").classList.toggle("flipped"); }
function fcMove(d) { fcIndex = (fcIndex + d + fcIds().length) % fcIds().length; renderFlashcards(); }
function fcMark(known) {
  const id = fcIds()[fcIndex];
  if (known) state.fcKnown[id] = true; else delete state.fcKnown[id];
  save();
  if (Object.keys(SIGNS).every(s => state.fcKnown[s])) unlock("signs");
  fcMove(1);
}

/* ---------------- STATS ---------------- */

function renderStats() {
  const acc = state.answered ? Math.round(100 * state.correctCount / state.answered) : null;
  $("ssAnswered").textContent = state.answered;
  $("ssAccuracy").textContent = acc === null ? "–" : acc + "%";
  $("ssStreak").textContent = state.streak.count;
  $("ssExams").textContent = state.exams.length;
  $("ssTime").textContent = fmtTime(state.timeStudied);
  $("ssHazard").textContent = state.hazardBest ? state.hazardBest + "/30" : "–";

  const lv = levelFor(state.xp);
  $("xpLabel").textContent = "Level " + lv.lvl;
  $("xpCount").textContent = `${lv.into}/${lv.need} XP`;
  $("xpBar").style.width = Math.round(100 * lv.into / lv.need) + "%";

  const ag = $("achGrid");
  ag.innerHTML = "";
  ACHIEVEMENTS.forEach(a => {
    const has = !!state.achievements[a.id];
    const d = document.createElement("div");
    d.className = "ach" + (has ? " got" : "");
    d.innerHTML = `${icon("award", 20)}<div><b>${a.name}</b><small>${a.desc}</small></div>`;
    ag.appendChild(d);
  });

  const ml = $("masteryList");
  ml.innerHTML = "";
  Object.entries(CATEGORIES).forEach(([id, c]) => {
    const qs = catQ(id);
    const m = Math.round(100 * Core.topicMastery(qs, state.qstats));
    const accC = catAccuracy(id);
    ml.innerHTML += `<div class="mastery-row">
      <span class="m-name">${icon(c.icon, 15)} ${c.name}</span>
      <div class="bar"><div class="bar-fill" style="width:${m}%"></div></div>
      <span class="m-val">${m}%${accC !== null ? ` <small>(${Math.round(accC * 100)}% acc)</small>` : ""}</span></div>`;
  });

  const hl = $("historyList");
  hl.innerHTML = state.exams.length
    ? state.exams.slice().reverse().map(e => {
        const d = new Date(e.date);
        return `<li class="${e.pass ? "pass" : "fail"}">
          <span>${icon(e.pass ? "check-circle" : "x-circle", 15)} ${e.label || "Exam"}</span>
          <span>${Math.round(e.pct * 100)}% (${e.correct}/${e.total})</span>
          <small>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></li>`;
      }).join("")
    : `<li class="muted">No exams yet — take your first mock exam!</li>`;

  $("selPassMark").value = String(state.settings.passMark);
  $("selExamLen").value = String(state.settings.examLen);
  $("chkFeedback").checked = !!state.settings.feedback;
  if ($("selStatePack")) $("selStatePack").value = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
  if ($("inpTestDate")) {
    $("inpTestDate").value = state.settings.testDate || "";
    $("inpTestDate").min = todayStr();
  }
  renderCalibration();
  renderStudy();
}

/* ---------------- real-test outcome journal (calibration beta) ---------------- */
function outcomeSnapshot() {
  return {
    progressPct: Math.round(readiness() * 100),
    mockAvgPct: Math.round((Core.mockAverage(state.exams) ?? 0) * 100),
    questionsSeen: state.answered,
    studyMinutes: Math.round((state.timeStudied || 0) / 60),
  };
}
function logOutcome(result) {
  state.outcomes = Core.appendOutcome(state.outcomes, { ...outcomeSnapshot(), result });
  save();
  renderCalibration();
  toast("Outcome logged", "Stored on this device only — included in backups.", "chart");
}
function renderCalibration() {
  const host = $("outcomeList");
  if (!host) return;
  const list = Array.isArray(state.outcomes) ? state.outcomes : [];
  host.innerHTML = list.length
    ? list.slice().reverse().map(o => {
        const d = new Date(o.date);
        const resLabel = o.result === "pass" ? "PASS" : o.result === "fail" ? "FAIL" : "?";
        return `<div class="outcome-row">
          <span>${d.toLocaleDateString()} · ${o.progressPct}% progress · mock avg ${o.mockAvgPct}% · ${o.questionsSeen} questions
            <span class="outcome-meta">${fmtTime(o.studyMinutes * 60)} of study</span></span>
          <b class="res-${o.result}">${resLabel}</b>
        </div>`;
      }).join("")
    : `<p class="muted" style="margin:0;">No outcomes logged yet.</p>`;
}

/* ---------------- practical drive log ---------------- */
const plFormState = { conditions: new Set(), roadTypes: new Set(), skills: {} };

function renderPractical() {
  if (!$("view-practical")) return;
  const log = Array.isArray(state.practical) ? [] : (state.practical.log || []);
  // readiness card
  const theoryPct = Math.round(readiness() * 100);
  const dr = Core.drivingReadiness(theoryPct, log);
  $("drValue").textContent = dr.combined === null ? "–" : dr.combined + "%";
  $("drTheory").textContent = theoryPct + "%";
  $("drPractical").textContent = dr.practical === null ? "no sessions yet" : Math.round(dr.practical * 100) + "%";

  // competencies + focus
  const scores = Core.competencyScores(log);
  const list = $("competencyList");
  list.innerHTML = "";
  for (const c of scores) {
    const pct = c.score === null ? null : Math.round(c.score * 100);
    const row = document.createElement("div");
    row.className = "mastery-row";
    row.innerHTML = `<span class="m-name">${c.name}</span>
      <div class="bar"><div class="bar-fill" style="width:${pct ?? 0}%"></div></div>
      <span class="m-val">${pct === null ? '<small>no data</small>' : pct + "%"}</span>`;
    list.appendChild(row);
    const meta = document.createElement("div");
    meta.className = "outcome-meta";
    meta.style.margin = "-4px 0 8px";
    meta.textContent = `${c.skillsPracticed}/${c.skillsTotal} skills practiced`;
    list.appendChild(meta);
  }
  const focus = Core.nextLessonFocus(log);
  $("nextFocus").innerHTML = focus.score === null
    ? `<b>${focus.name}</b> — ${focus.reason}.`
    : `<b>${focus.name}</b> (${Math.round(focus.score * 100)}%) — ${focus.reason}.`;

  // history
  const hist = $("sessionList");
  hist.innerHTML = log.length
    ? log.slice().reverse().map((s, idxRev) => {
        const realIdx = log.length - 1 - idxRev;
        const d = new Date(s.date).toLocaleDateString();
        const marks = Object.values(s.skills || {});
        const good = marks.filter(r => r === "good").length;
        const ok = marks.filter(r => r === "ok").length;
        const poor = marks.filter(r => r === "poor").length;
        const tags = s.conditions.concat(s.roadTypes).join(" · ");
        return `<li class="pl-session">
          <div class="pl-session-head">
            <span><b>${d}</b> · ${s.minutes} min</span>
            <span class="pl-marks">✓${good} △${ok} ✗${poor}</span>
          </div>
          <div class="outcome-meta">${tags || "—"}${s.notes ? ` · ${escapeHTML(s.notes.slice(0, 120))}` : ""}</div>
          <button class="btn ghost pl-del" data-i="${realIdx}" aria-label="Delete session">Delete</button>
        </li>`;
      }).join("")
    : `<li class="muted">No sessions logged yet.</li>`;
  list.querySelectorAll && null;
  hist.querySelectorAll(".pl-del").forEach(b => on(b, "click", () => {
    state.practical.log.splice(Number(b.dataset.i), 1);
    save(); renderPractical();
  }));

  // form defaults once
  if ($("plDate") && !$("plDate").value) $("plDate").value = todayStr();
}

function buildPracticalForm() {
  const chipRow = (host, values, set, key) => {
    host.innerHTML = "";
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = v.replace(/-/g, " ");
      b.setAttribute("aria-pressed", String(set.has(v)));
      on(b, "click", () => {
        set.has(v) ? set.delete(v) : set.add(v);
        b.setAttribute("aria-pressed", String(set.has(v)));
      });
      host.appendChild(b);
    }
  };
  chipRow($("plConditions"), Core.CONDITIONS, plFormState.conditions, "conditions");
  chipRow($("plRoadTypes"), Core.ROAD_TYPES, plFormState.roadTypes, "roadTypes");

  const sk = $("plSkills");
  sk.innerHTML = "";
  for (const comp of Core.COMPETENCIES) {
    const block = document.createElement("div");
    block.className = "pl-comp";
    const title = document.createElement("div");
    title.className = "pl-comp-name";
    title.textContent = comp.name;
    block.appendChild(title);
    for (const skillId of comp.skills) {
      const rowEl = document.createElement("div");
      rowEl.className = "pl-skill-row";
      const nameSpan = document.createElement("span");
      nameSpan.className = "pl-skill-name";
      nameSpan.textContent = skillId.replace(/-/g, " ");
      rowEl.appendChild(nameSpan);
      const seg = document.createElement("div");
      seg.className = "seg3";
      for (const [val, glyph] of [["good", "✓"], ["ok", "△"], ["poor", "✗"]]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = glyph;
        btn.setAttribute("aria-label", `${skillId}: ${val}`);
        btn.setAttribute("aria-pressed", String(plFormState.skills[skillId] === val));
        on(btn, "click", () => {
          if (plFormState.skills[skillId] === val) delete plFormState.skills[skillId];
          else plFormState.skills[skillId] = val;
          seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(plFormState.skills[skillId] === x.getAttribute("aria-label").split(": ")[1])));
        });
        seg.appendChild(btn);
      }
      rowEl.appendChild(seg);
      block.appendChild(rowEl);
    }
    sk.appendChild(block);
  }
}

function savePracticalSession() {
  const minutes = parseInt($("plMinutes").value, 10);
  const skills = Object.keys(plFormState.skills);
  if (!skills.length) { alert("Rate at least one skill before saving."); return; }
  const dateVal = $("plDate").value ? Date.parse($("plDate").value + "T12:00:00Z") : Date.now();
  state.practical.log = Core.appendPracticalSession(state.practical.log || [], {
    date: isFinite(dateVal) ? dateVal : Date.now(),
    minutes: isFinite(minutes) ? minutes : 45,
    conditions: [...plFormState.conditions],
    roadTypes: [...plFormState.roadTypes],
    skills: { ...plFormState.skills },
    notes: $("plNotes").value,
  });
  save();
  plFormState.conditions.clear();
  plFormState.roadTypes.clear();
  plFormState.skills = {};
  buildPracticalForm();
  $("plNotes").value = "";
  renderPractical();
  toast("Session logged", "Competencies updated.", "car");
}

/* ---------------- learner study (research) ---------------- */
function renderStudy() {
  const intro = $("studyIntro"), body = $("studyBody");
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
  $("studyDay").textContent = days;
  $("studyMetrics").innerHTML =
    `<div>Diagnostic <b>${m.diagnosticPct === null ? "–" : m.diagnosticPct + "%"}</b> · latest mock <b>${m.latestMockPct === null ? "–" : m.latestMockPct + "%"}</b> · improvement <b>${m.improvementPct === null ? "–" : (m.improvementPct > 0 ? "+" : "") + m.improvementPct + " pts"}</b></div>
     <div class="outcome-meta">${m.questionsAnswered} questions · ${m.studyHours} h · mocks ${m.mockCount} · retention ${m.retentionAttempts ? Math.round(100 * m.retentionCorrect / m.retentionAttempts) + "% (" + m.retentionAttempts + ")" : "–"}</div>`;

  // confidence survey until all topics rated
  const survey = $("confidenceSurvey");
  const rated = new Set(state.study.confidence.map(c => c.catId));
  const missing = Object.keys(CATEGORIES).filter(c => !rated.has(c));
  if (missing.length) {
    survey.hidden = false;
    survey.innerHTML = `<p class="outcome-meta" style="margin:0 0 6px;">Before studying: how confident are you per topic? (1 = no idea, 5 = very confident)</p>` +
      missing.slice(0, 3).map(cat => {
        const c = CATEGORIES[cat];
        return `<div class="pl-skill-row"><span class="pl-skill-name">${c.name}</span><span class="seg3">` +
          [1, 2, 3, 4, 5].map(l => `<button type="button" data-cat="${cat}" data-level="${l}" aria-label="${c.name}: ${l}" aria-pressed="false">${l}</button>`).join("") + `</span></div>`;
      }).join("");
    survey.querySelectorAll("button[data-cat]").forEach(b => on(b, "click", () => {
      state.study.confidence.push({ catId: b.dataset.cat, level: Number(b.dataset.level) });
      save(); renderStudy();
    }));
    if ($("btnDiagnostic")) $("btnDiagnostic").disabled = true;
  } else {
    survey.hidden = true;
    if ($("btnDiagnostic")) $("btnDiagnostic").disabled = !!state.exams.some(e => e.tag === "diagnostic");
    if ($("btnDiagnostic")) $("btnDiagnostic").textContent = state.exams.some(e => e.tag === "diagnostic") ? "Baseline recorded ✓" : "Baseline diagnostic exam";
  }

  // retention probes
  const pool = Core.retentionProbePool(bank, state.qstats, state.study.retentionLog, Date.now());
  $("btnRetentionProbes").hidden = pool.length === 0;
  $("retentionHint").textContent = pool.length
    ? `${pool.length} question${pool.length === 1 ? "" : "s"} from a week or more ago are ready for a memory check.`
    : `Memory checks appear once you've mastered questions 7+ days ago.`;
}

function joinStudy() {
  if (!confirm("Join the learner study?\n\n· Fully anonymous random ID — no account, no personal data\n· Data stays on this device until you export it\n· Free-text notes are never exported")) return;
  const e = Core.createEnrollment(Date.now());
  state.study.enrolledAt = e.enrolledAt;
  state.study.participantId = e.participantId;
  save(); renderStudy();
}

function startDiagnostic() {
  quizBackTarget = "stats";
  const qs = Core.assembleExam({ bank, n: 20, samplingMode: "fixed", seed: 0xD1A6 });
  session = { mode: "exam", tag: "diagnostic", label: "Baseline Diagnostic", questions: qs, i: 0, correct: 0, answers: [], timeLeft: Core.timeLimitSecs(qs.length), endTs: 0, timerId: null };
  beginQuiz();
}

function startRetentionProbes() {
  const pool = Core.retentionProbePool(bank, state.qstats, state.study.retentionLog, Date.now());
  if (!pool.length) return;
  quizBackTarget = "stats";
  session = { mode: "practice", tag: "retention", label: "Memory Check", questions: shuffle(pool), i: 0, correct: 0, answers: [], endTs: 0, timerId: null, marathon: false, requeued: {} };
  beginQuiz();
}

function exportStudyData() {
  const bundle = Core.buildStudyExport(state, bank, Date.now(), { appVersion: APP_VERSION });
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `road-ready-study-${state.study.participantId}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------------- theme ---------------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  $("btnTheme").innerHTML = icon(state.settings.theme === "dark" ? "sun" : "moon", 17);
}

/* ---------------- HAZARD PERCEPTION ---------------- */
const HZ = { V: 110, W: 360, H: 420, RL: 96, RR: 264, CARX: 158, CARY: 344 };
const Y = (t, ts) => -46 + HZ.V * (t - ts);           // scroll position of an object spawned at ts
const HZ_SCENARIOS = [
  {
    name: "Ball & child", win: [2.6, 6.0], max: 7.6,
    tip: "A rolling ball means a child is close behind — react the moment you see it.",
    objs: t => {
      let s = "";
      if (t >= 1.2) s += hzBall(300 - 50 * (t - 2.6), Y(t, 2.6));
      if (t >= 4.0) s += hzPerson(320 - 70 * (t - 4.0), Y(t, 4.0));
      return s;
    },
  },
  {
    name: "Parked car door", win: [3.0, 5.6], max: 7.2,
    tip: "Park beside the door zone — expect doors to open and leave a gap.",
    objs: t => {
      let s = hzParked(Y(t, 2.0));
      if (t >= 3.2) s += hzDoor(Y(t, 2.0), Math.min(1, (t - 3.2) / 1.1));
      return s;
    },
  },
  {
    name: "Brake lights ahead", win: [3.0, 5.1], max: 6.8,
    tip: "Brake lights far ahead are your first warning — ease off the gas early.",
    objs: t => {
      const y = -46 + HZ.V * (t - 3.0) + (t > 3.6 ? 30 * (t - 3.6) * (t - 3.6) : 0);
      return hzCarAhead(178, y, t > 3.4 && Math.floor(t * 4) % 2 === 0);
    },
  },
  {
    name: "Deer crossing", win: [3.2, 4.9], max: 6.5,
    tip: "Where one animal crosses, more follow — brake in your lane, don't swerve.",
    objs: t => hzDeer(30 + (t >= 3.2 ? 60 * (t - 3.2) : 0), Y(t, 1.6)),
  },
  {
    name: "Crosswalk ahead", win: [3.0, 5.4], max: 7.0,
    tip: "A waiting pedestrian plus a crosswalk = slow now, not when they step out.",
    objs: t => {
      let s = hzCrosswalk(Y(t, 1.4));
      s += hzPerson(292 - (t >= 4.0 ? 60 * (t - 4.0) : 0), Y(t, 1.4) + 8);
      return s;
    },
  },
  {
    name: "Cyclist swerve", win: [2.6, 4.6], max: 6.2,
    tip: "Riders swerve for hazards you can't see — give them room to do it.",
    objs: t => hzCyclist(246 - (t >= 2.6 ? 38 * (t - 2.6) : 0), Y(t, 1.8)),
  },
];

function hzRR(x, y, w, h, fill, rx, extra) {
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${rx || 4}" fill="${fill}" ${extra || ""}/>`;
}
function hzC(x, y, r, fill) { return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`; }
function hzBall(x, y) { return hzC(x, y, 7, "#c1272d") + hzC(x - 2, y - 2, 2, "rgba(255,255,255,.35)"); }
function hzPerson(x, y) { return hzC(x, y, 7, "#e8e8ec") + hzRR(x - 6, y + 6, 12, 16, "#8b8b93", 4) + hzRR(x - 8, y + 8, 16, 4, "#c1272d", 2); }
function hzParked(y) { return hzRR(226, y, 34, 64, "#3a3a44", 6) + hzRR(230, y + 8, 26, 18, "#26262e", 3); }
function hzDoor(y, k) { return hzRR(226 - 24 * k, y + 14, 24 * k, 34, "#8b8b93", 3); }
function hzCarAhead(x, y, braking) {
  let s = hzRR(x - 20, y, 40, 58, "#4a4a55", 6) + hzRR(x - 14, y + 8, 28, 16, "#26262e", 3);
  if (braking) s += hzC(x - 12, y + 54, 4, "#c1272d") + hzC(x + 12, y + 54, 4, "#c1272d");
  return s;
}
function hzDeer(x, y) { return hzRR(x - 16, y - 6, 34, 14, "#8a6d4f", 6) + hzRR(x + 14, y - 12, 12, 8, "#8a6d4f", 3) + hzRR(x - 12, y + 8, 4, 10, "#6f573d", 1) + hzRR(x + 6, y + 8, 4, 10, "#6f573d", 1); }
function hzCrosswalk(y) {
  let s = "";
  for (let i = 0; i < 5; i++) s += hzRR(102, y + i * 15, 156, 8, "rgba(255,255,255,.75)", 2);
  return s;
}
function hzCyclist(x, y) { return hzRR(x - 5, y - 8, 12, 14, "#e8e8ec", 4) + hzC(x - 10, y + 12, 6, "#0b0b0d") + hzC(x + 12, y + 12, 6, "#0b0b0d") + hzRR(x - 16, y - 4, 8, 3, "#8b8b93", 1); }

let hz = null;
function hzScene(t, sc) {
  const W = HZ.W, H = HZ.H, RL = HZ.RL, RR = HZ.RR;
  let s = `<rect width="${W}" height="${H}" fill="#0b0b0d"/>`;
  s += hzRR(0, 0, W, H, "#101013");
  s += hzRR(RL - 18, 0, 18, H, "#1b1b21", 0) + hzRR(RR, 0, 18, H, "#1b1b21", 0);
  s += hzRR(RL, 0, RR - RL, H, "#17171c", 0);
  s += hzRR(RL - 4, 0, 4, H, "rgba(255,255,255,.25)", 0) + hzRR(RR, 0, 4, H, "rgba(255,255,255,.25)", 0);
  const mod = (HZ.V * t) % 46;
  for (let y = -46 + mod; y < H + 40; y += 46) s += hzRR(W / 2 - 2, y, 4, 24, "rgba(255,255,255,.28)", 1);
  const tm = (HZ.V * t) % 150;
  for (let k = -1; k < 4; k++) {
    const ty = k * 150 + tm - 30;
    s += hzC(44, ty, 13, "#1d1d24") + hzRR(41, ty + 8, 6, 12, "#141419", 2);
    s += hzC(316, ty + 75, 13, "#1d1d24") + hzRR(313, ty + 83, 6, 12, "#141419", 2);
  }
  s += sc.objs(t);
  s += hzRR(HZ.CARX, HZ.CARY, 44, 66, "#e8e8ec", 10) + hzRR(HZ.CARX + 6, HZ.CARY + 10, 32, 14, "#0b0b0d", 4) + hzRR(HZ.CARX + 6, HZ.CARY + 40, 32, 10, "#b9b9c2", 3);
  return s;
}
function hzShowOverlay(html) { $("hzOverlay").innerHTML = html; $("hzOverlay").classList.add("show"); }
function hzHideOverlay() { $("hzOverlay").classList.remove("show"); }
function hzStartGame() {
  hz = { i: 0, scores: [], press: null, t0: 0, timer: null, running: false, marked: false };
  showView("hazard");
  hzIntro();
}
function hzIntro() {
  const best = state.hazardBest ? ` · best ${state.hazardBest}/30` : "";
  hzShowOverlay(`
    <div class="ov-inner">
      <span class="ov-ico">${icon("eye", 34)}</span>
      <h2>Hazard Perception</h2>
      <p>6 scenarios. One hazard each.<br>Tap <b>SLOW</b> — or press <b>Space</b> — as soon as the hazard starts to develop.</p>
      <p class="ov-dim">5 points for instant recognition, down to 1. Too early or too late scores 0${best}.</p>
      <button class="btn primary" id="hzGo">Start</button>
    </div>`);
  $("hzGo").focus();
  on($("hzGo"), "click", hzNextScenario);
}
function hzNextScenario() {
  if (hz.i >= HZ_SCENARIOS.length) return hzResults();
  const sc = HZ_SCENARIOS[hz.i];
  hz.press = null; hz.marked = false; hz.running = false;
  $("hzSlow").classList.remove("pressed");
  $("hzFlash").hidden = true;
  hzShowOverlay(`<div class="ov-inner"><p class="ov-count">${hz.i + 1} / ${HZ_SCENARIOS.length}</p><h2>${sc.name}</h2><p class="ov-dim">Get ready…</p></div>`);
  $("hzSvg").innerHTML = hzScene(0, { objs: () => "" });
  setTimeout(() => {
    hzHideOverlay();
    hz.running = true;
    hz.t0 = performance.now();
    hz.timer = setInterval(() => {
      const t = (performance.now() - hz.t0) / 1000;
      $("hzSvg").innerHTML = hzScene(t, sc);
      if (t >= sc.max) hzEndScenario(sc);
    }, 60);
  }, 1400);
}
function hzPress() {
  if (!hz || !hz.running || hz.marked) return;
  hz.marked = true;
  hz.press = (performance.now() - hz.t0) / 1000;
  $("hzSlow").classList.add("pressed");
}
function hzEndScenario(sc) {
  clearInterval(hz.timer);
  hz.running = false;
  const [s, e] = sc.win;
  const press = hz.press;
  const r = Core.hazardScore(press, s, e);
  let pts = r.pts, verdict;
  if (r.band === "late") { verdict = "Too late — the hazard fully developed"; $("hzFlash").hidden = false; }
  else if (r.band === "early") { verdict = "Too early — nothing was developing yet"; }
  else if (r.band === "instant") verdict = "Instant recognition";
  else if (r.band === "good") verdict = "Good spot";
  else verdict = "Cutting it close";
  hz.scores.push(pts);
  hzShowOverlay(`
    <div class="ov-inner">
      <p class="ov-count">${hz.i + 1} / ${HZ_SCENARIOS.length} · ${sc.name}</p>
      <div class="ov-pts ${pts ? "" : "zero"}">${pts ? "+" + pts : "0"} pts</div>
      <p><b>${verdict}</b></p>
      <p class="ov-dim">${sc.tip}</p>
    </div>`);
  hz.i++;
  setTimeout(() => { if (hz) hzNextScenario(); }, 2600);
}
function hzResults() {
  const total = hz.scores.reduce((a, b) => a + b, 0);
  const best = Math.max(state.hazardBest, total);
  const isNew = total > state.hazardBest;
  state.hazardBest = best;
  addXP(total * Core.XP_PER_HAZARD_POINT);
  if (total >= 24) unlock("hawk");
  save();
  checkProgressAchievements();
  hzShowOverlay(`
    <div class="ov-inner">
      <span class="ov-ico">${icon(total >= 18 ? "trophy" : "eye", 34)}</span>
      <h2>${total} / 30</h2>
      <p>${total >= 24 ? "Hawk-level awareness." : total >= 18 ? "Solid instincts — polish the early spots." : "Keep training — early recognition is the skill."}</p>
      ${isNew ? `<p class="ov-dim">New personal best</p>` : `<p class="ov-dim">Best: ${best}/30</p>`}
      <div class="ov-btns">
        <button class="btn ghost" id="hzAgain">Play Again</button>
        <button class="btn primary" id="hzDone">Done</button>
      </div>
    </div>`);
  on($("hzAgain"), "click", hzStartGame);
  on($("hzDone"), "click", () => { hz = null; renderHome(); showView("home"); });
}

/* ---------------- ONBOARDING ---------------- */
let obStep = 0;
function showOnboarding() {
  const ob = $("onboarding");
  ob.hidden = false;
  obStep = 0;
  hydrateIcons(ob);
  obRender();
  on($("obSkip"), "click", finishOnboarding);
  on($("obNext"), "click", () => {
    if (obStep >= 3) finishOnboarding();
    else { obStep++; obRender(); }
  });
  on($("obThemeDark"), "click", () => { state.settings.theme = "dark"; save(); applyTheme(); obRender(); });
  on($("obThemeLight"), "click", () => { state.settings.theme = "light"; save(); applyTheme(); obRender(); });
  on($("obTtsOn"), "click", () => { state.settings.tts = true; save(); applyTTS(); obRender(); });
  on($("obTtsOff"), "click", () => { state.settings.tts = false; save(); applyTTS(); obRender(); });
}
function obRender() {
  const steps = document.querySelectorAll(".ob-step");
  /** @type {NodeListOf<HTMLElement>} */(steps).forEach(s => s.classList.toggle("on", +s.dataset.step === obStep));
  document.querySelectorAll("#obDots span").forEach((d, i) => d.classList.toggle("on", i === obStep));
  $("obNext").textContent = obStep >= 3 ? "Start studying" : obStep === 2 ? "Almost done" : "Next";
  document.querySelectorAll("#obThemeDark, #obThemeLight").forEach(b =>
    b.classList.toggle("sel", (b.id === "obThemeDark") === (state.settings.theme === "dark")));
  document.querySelectorAll("#obTtsOn, #obTtsOff").forEach(b =>
    b.classList.toggle("sel", (b.id === "obTtsOn") === !!state.settings.tts));
}
function finishOnboarding() {
  state.onboarded = true;
  save();
  $("onboarding").hidden = true;
  renderHome();
  toast("Welcome aboard", "Start with Adaptive Practice — 10 questions.", "car");
}

/* ---------------- wire up ---------------- */
function init() {
  applyTheme();
  hydrateIcons(document);
  applyTTS();
  initStatePackSelect();
  renderStateFacts();
  renderHome();
  renderFlashcards();
  if (!state.onboarded) showOnboarding();
  registerServiceWorker();

  // read-aloud toggle
  on($("btnTTS"), "click", () => {
    state.settings.tts = !state.settings.tts;
    save(); applyTTS();
    if (state.settings.tts && session) speak($("qText").textContent);
    else stopSpeaking();
  });

  // hazard perception
  on($("fcHazard"), "click", hzStartGame);
  on($("hzSlow"), "click", hzPress);
  on($("hzQuit"), "click", () => {
    if (hz && hz.timer) clearInterval(hz.timer);
    hz = null;
    renderHome(); showView("home");
  });

  on($("btnTheme"), "click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
  });
  on($("btnBack"), "click", () => {
    if (session && session.mode === "exam" && !session.finished &&
        !confirm("Leave the exam? Your progress will not be saved.")) return;
    if (session && session.timerId) clearInterval(session.timerId);
    showView(quizBackTarget || "home");
  });
  on($("btnNext"), "click", nextQuestion);
  on($("btnQuit"), "click", () => {
    if (!session) return showView("home");
    if (session.mode === "exam" &&
        !confirm("Submit the exam and see your score now?")) return;
    finishSession();
  });
  on($("btnFlag"), "click", toggleFlag);
  on($("btnAgain"), "click", () => {
    if (session && session.mode === "exam") startExam(session.questions.length);
    else startPractice(pickWeighted(adaptivePool(), session ? session.questions.length : 10), "Adaptive Mix", "home");
  });
  on($("btnReviewMissed"), "click", () => showView("review"));
  on($("btnHomeR"), "click", () => { renderHome(); showView("home"); });
  on($("btnDrillMissed"), "click", () => {
    const ids = (session && session.lastMissed) || missedQuestions().map(q => q.id);
    const qs = ids.map(id => byId[id]).filter(Boolean);
    if (qs.length) startPractice(shuffle(qs).slice(0, 15), "Missed Questions", "home");
  });

  // nav
  /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#bottomNav button")).forEach(b => {
    on(b, "click", () => {
      const t = b.dataset.nav;
      if (t === "practice") startSetup("practice");
      else if (t === "exam") startSetup("exam");
      else if (t === "flashcards") { renderFlashcards(); showView("flashcards"); }
      else if (t === "guide") showView("guide");
      else if (t === "stats") { renderStats(); showView("stats"); }
      else { renderHome(); showView("home"); }
    });
  });
  // hero quick actions
  on($("qaPractice"), "click", () => startSetup("practice"));
  on($("qaExam"), "click", () => startSetup("exam"));
  on($("qaCards"), "click", () => { renderFlashcards(); showView("flashcards"); });
  on($("qaPractical"), "click", () => { renderPractical(); showView("practical"); });
  buildPracticalForm();
  on($("btnSaveSession"), "click", savePracticalSession);
  on($("qaReview"), "click", () => {
    const m = missedQuestions();
    if (!m.length) { alert("Nothing missed yet — keep practicing!"); return; }
    startPractice(pickWeighted(m.map(q => ({ q, w: 1 })), Math.min(10, m.length)), "Missed Questions", "home");
  });
  on($("btnPlanAction"), "click", e => {
    const action = e.currentTarget.dataset.action;
    if (action === "set-date") {
      renderStats(); showView("stats");
      setTimeout(() => { $("inpTestDate").scrollIntoView({ block: "center" }); $("inpTestDate").focus(); }, 0);
      return;
    }
    if (action === "exam") { startSetup("exam"); return; }
    if (action === "review") {
      const missed = missedQuestions();
      if (missed.length) {
        startPractice(pickWeighted(missed.map(q => ({ q, w: 1 })), Math.min(20, missed.length)), "Test Day Review", "home");
        return;
      }
    }
    const plan = Core.studyPlan(bank, state.qstats, state.exams, state.daily, state.settings.testDate, todayStr());
    const size = Math.min(20, Math.max(10, plan.remainingToday || 10));
    startPractice(pickWeighted(adaptivePool(), size), "Today's Plan", "home");
  });

  // flashcards
  on($("flashcard"), "click", flipCard);
  on($("flashcard"), "keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); } });
  on($("btnFcPrev"), "click", () => fcMove(-1));
  on($("btnFcNext"), "click", () => fcMove(1));
  on($("btnFcYes"), "click", () => fcMark(true));
  on($("btnFcNo"), "click", () => fcMark(false));
  on($("btnFcShuffle"), "click", () => {
    state.fcOrder = shuffle(Object.keys(SIGNS));
    fcIndex = 0; save(); renderFlashcards();
  });
  on($("btnFcReset"), "click", () => {
    if (!confirm("Reset all 'known' marks?")) return;
    state.fcKnown = {}; state.fcOrder = null; save(); renderFlashcards();
  });

  // settings
  on($("selPassMark"), "change", e => { state.settings.passMark = parseFloat(e.target.value); save(); });
  on($("selExamLen"), "change", e => { state.settings.examLen = parseInt(e.target.value, 10); save(); });
  on($("chkFeedback"), "change", e => { state.settings.feedback = e.target.checked; save(); });
  on($("inpTestDate"), "change", e => {
    state.settings.testDate = Core.validIsoDate(e.target.value) ? e.target.value : "";
    save(); renderHome();
    toast(state.settings.testDate ? "Test day plan ready" : "Test date cleared",
      state.settings.testDate ? "Your daily target now adapts to the time remaining." : "Your daily goal is back to 10 questions.",
      "clock");
  });
  on($("selStatePack"), "change", e => {
    state.settings.statePack = e.target.value;
    save();
    bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
    renderStateFacts();
    renderHome();
    const pack = Packs.STATE_PACKS[e.target.value] || Packs.STATE_PACKS.generic;
    const n = (pack.questions || []).length;
    toast("State pack: " + pack.name,
      n ? `${n} state-specific questions added · key rules updated` : "Universal questions — confirm specifics with your handbook.",
      "car");
  });
  on($("btnExport"), "click", exportProgress);
  on($("btnOutcomePass"), "click", () => {
    if (confirm("Log that you PASSED your real knowledge test? The snapshot below is stored only on this device.")) logOutcome("pass");
  });
  on($("btnStudyJoin"), "click", joinStudy);
  on($("btnDiagnostic"), "click", startDiagnostic);
  on($("btnRetentionProbes"), "click", startRetentionProbes);
  on($("btnStudyExport"), "click", exportStudyData);
  on($("btnOutcomeFail"), "click", () => {
    if (confirm("Log that you DID NOT pass your real knowledge test? Honest data is what makes future predictions meaningful.")) logOutcome("fail");
  });
  on($("btnImport"), "click", () => $("fileImport").click());
  on($("fileImport"), "change", e => {
    const f = e.target.files && e.target.files[0];
    if (f) importProgress(f);
    e.target.value = "";
  });
  on($("btnResetAll"), "click", () => {
    if (!confirm("Erase ALL progress, stats, and history? This cannot be undone.")) return;
    const theme = state.settings.theme;
    state = Core.defaultState(); state.settings.theme = theme;
    bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
    save(); renderStateFacts(); renderStats(); renderHome(); renderFlashcards();
    alert("Progress reset. Fresh start!");
  });

  // keyboard
  document.addEventListener("keydown", e => {
    const active = document.querySelector(".view.active");
    if (!active) return;
    if (active.id === "view-quiz") {
      if (e.key >= "1" && e.key <= "4") {
        const btns = /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#choices .choice"));
        const b = btns[parseInt(e.key, 10) - 1];
        if (b && !session.answeredCurrent) { b.classList.add("picked"); b.click(); }
      } else if (e.key === "Enter") { if (!$("btnNext").disabled) nextQuestion(); }
      else if (e.key.toLowerCase() === "f") toggleFlag();
    } else if (active.id === "view-flashcards") {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); }
      else if (e.key === "ArrowRight") fcMove(1);
      else if (e.key === "ArrowLeft") fcMove(-1);
      else if (e.key.toLowerCase() === "k") fcMark(true);
      else if (e.key.toLowerCase() === "l") fcMark(false);
    } else if (active.id === "view-hazard") {
      if (e.key === " ") { e.preventDefault(); hzPress(); }
    }
  });

  showView("home");
}

/* state pack selector (settings) */
function initStatePackSelect() {
  const sel = $("selStatePack");
  if (!sel) return;
  sel.innerHTML = "";
  // country group header, then its regions — the pluggable tree, visible
  if (COUNTRY) {
    const g = document.createElement("optgroup");
    g.label = COUNTRY.name + " — " + TERMS.agencyShort;
    const tree = Jur.jurisdictionTree({
      STATE_PACKS: Packs.STATE_PACKS,
      EXAM_BLUEPRINTS: BLUEPRINTS,
      SOURCE_REGISTRY: Packs.SOURCE_REGISTRY || {},
    });
    const us = tree.find((c) => c.id === COUNTRY.id);
    const generic = document.createElement("option");
    generic.value = "generic";
    generic.textContent = "General U.S. rules";
    g.appendChild(generic);
    (us ? us.regions : []).forEach((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name + (r.exam ? ` · ${r.exam.questionCount}q` : "");
      o.dataset.exam = r.exam ? JSON.stringify(r.exam) : "";
      g.appendChild(o);
    });
    sel.appendChild(g);
  } else {
    Packs.PACK_IDS.forEach(id => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = Packs.STATE_PACKS[id].name;
      sel.appendChild(o);
    });
  }
  sel.value = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
}

/* study-guide facts card for the selected jurisdiction */
const FACT_LABELS = {
  bacAdult: "Adult BAC limit",
  bacUnder21: "Under-21 limit",
  followDistance: "Following distance",
  rightOnRed: "Right on red",
  schoolBus: "School bus",
};
function renderStateFacts() {
  const host = $("stateFacts");
  if (!host) return;
  const packId = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
  const pack = Packs.STATE_PACKS[packId];
  const source = Packs.packSource(packId);
  const n = (pack.questions || []).length;
  const rows = Object.entries(pack.facts).map(([k, v]) => {
    const label = FACT_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
    return `<div class="fact-row"><span>${label}</span><b>${v}</b></div>`;
  }).join("");
  host.hidden = false;
  const note = pack.note || (source ? `Rules and figures are mapped to the ${source.title}. Laws can change, so confirm before test day.` : "");
  host.innerHTML = `
    <h2 class="section-title">${pack.name}</h2>
    <div class="card state-facts-card">
      <p class="state-note">${escapeHTML(note)}</p>
      <div class="facts-grid">${rows}</div>
      ${n ? `<p class="state-qcount">${n} ${packId}-specific questions are included in your practice and exams.</p>` : ""}
      ${source ? `<a class="source-link state-source" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">Open official ${escapeHTML(source.agency)} handbook ↗</a>` : ""}
    </div>`;
}

/* PWA: offline-first service worker */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // file:// has no SW; only register when served over http(s)
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register("sw.js").catch(err => console.warn("[road-ready] SW:", err));
}

init();
