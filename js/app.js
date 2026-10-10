/* Road Ready — app logic */
"use strict";

const Core = window.RoadReadyCore;
const Coach = window.RoadReadyCoach;
const Explain = window.RoadReadyExplain;
const Evidence = window.RoadReadyEvidence;
const Mastery = window.RoadReadyMastery;
const Format = window.RoadReadyFormat || {};
const Packs = window.RoadReadyPacks;
const BLUEPRINTS = (window.RoadReadyBlueprints || {}).EXAM_BLUEPRINTS || {};
const Jur = window.RoadReadyJurisdictions || {};
const AccountUI = window.RoadReadyAccountUI;
const Guide = window.RoadReadyGuide;
// Practical-log UI lives in js/practical-ui.js; it gets its dependencies here
// instead of reaching into this file's scope.
const PracticalUI = window.RoadReadyPracticalUI;
const StudyUI = window.RoadReadyStudyUI;
// Extracted UI domains (same DI style as practical-ui/study-ui): each gets its
// dependencies explicitly here instead of reaching into this file's scope.
const FlashcardsUI = window.RoadReadyFlashcardsUI;
const ReviewUI = window.RoadReadyReviewUI;
const ResultsUI = window.RoadReadyResultsUI;
const HomeUI = window.RoadReadyHomeUI;
const QuizUI = window.RoadReadyQuizUI;
const ConceptMapUI = window.RoadReadyConceptMapUI;
const StatsUI = window.RoadReadyStatsUI;
if (PracticalUI) {
  PracticalUI.init({
    Core,
    form: { conditions: new Set(), roadTypes: new Set(), skills: {} },
    getState: () => state,
    save: () => save(),
    render: () => renderPractical(),
    toast,
    todayStr: () => todayStr(),
    readiness: () => readiness(),
  });
}
/** Delegates to js/practical-ui.js (absent only if that script failed to load). */
function renderPractical() {
  if (PracticalUI) PracticalUI.render();
}

if (StudyUI) {
  StudyUI.init({
    Core,
    CATEGORIES,
    getState: () => state,
    save: () => save(),
    getBank: () => bank,
    appVersion: () => APP_VERSION,
  });
}
/** Delegates to js/study-ui.js (absent only if that script failed to load). */
function renderStudy() {
  if (StudyUI) StudyUI.render();
}

// Shared dependencies for the extracted UI modules. Resolved lazily because
// several helpers (bank, state, byId) are declared later in this file — a
// direct reference here would hit the temporal dead zone at load time and
// crash the app on boot. Every late-bound entry is a thunk or accessor.
function extractedDeps() {
  return {
    Core, Coach, Explain, Mastery, CATEGORIES, SIGNS, signSVG,
    getState: () => state,
    getBank: () => bank,
    getQuestion: (id) => byId[id],
    icon,
    escapeHTML,
    sourceCitationHTML,
    signArt: (id, size) => signArt(id, size),
    startPractice: (qs, label, backTo, marathon) => startPractice(qs, label, backTo, marathon),
    shuffle: (arr) => shuffle(arr),
    showView: (name) => showView(name),
    unlock,
    save: () => save(),
    termsForPack: (packId) => termsForPack(packId),
  };
}
if (FlashcardsUI) FlashcardsUI.init(extractedDeps());
if (ReviewUI) ReviewUI.init(Object.assign(extractedDeps(), { alert: (msg) => alert(msg) }));
if (ResultsUI) ResultsUI.init(extractedDeps());
if (StatsUI) {
  StatsUI.init(Object.assign(extractedDeps(), {
    // ACHIEVEMENTS is declared later in this file — a direct reference here
    // would hit the temporal dead zone at load time and crash boot.
    ACHIEVEMENTS: Core.ACHIEVEMENTS,
    catQ: (id) => catQ(id),
    catAccuracy: (id) => catAccuracy(id),
    readiness: () => readiness(),
    fmtTime,
    levelFor,
    hazardScenarioCount: () => HZ_SCENARIOS.length,
    hazardCategories: (name) => {
      const sc = (typeof HZ_SCENARIOS !== "undefined" ? HZ_SCENARIOS : []).find((s) => s.name === name);
      return sc ? sc.category : null;
    },
    hazardCategoryLabel: (cat) => (HazardScenarios && HazardScenarios.categoryLabel
      ? HazardScenarios.categoryLabel(cat) : String(cat || "").replace(/-/g, " ")),
    renderFluency: () => renderFluency(),
    renderStudy: () => renderStudy(),
    save: () => save(),
    toast,
    renderHome: () => renderHome(),
    showView: (name) => showView(name),
    openConceptMap: (id) => {
      if (ConceptMapUI) { ConceptMapUI.render(id); showView("conceptmap"); }
    },
    appVersion: () => APP_VERSION,
    PackIds: Packs.PACK_IDS,
    todayStr: () => todayStr(),
  }));
}

if (HomeUI) {
  HomeUI.init(Object.assign(extractedDeps(), {
    Evidence,
    catQ: (id) => catQ(id),
    catAccuracy: (id) => catAccuracy(id),
    readiness: () => readiness(),
    missedQuestions: () => missedQuestions(),
    todayStr: () => todayStr(),
    validTestDate: () => validTestDate(),
    hazardInfoForPack: (packId) => hazardInfoForPack(packId),
    hazardScenarioCount: () => HZ_SCENARIOS.length,
    checkProgressAchievements,
    levelFor,
    predictionCalibrationSamples: () => predictionCalibrationSamples(),
    buildCalibrationCurve: (samples) => buildCalibrationCurve(samples),
    CALIBRATION_CONTEXT: () => CALIBRATION_CONTEXT(),
    ConceptMapUI,
  }));
}

if (ConceptMapUI) {
  ConceptMapUI.init(Object.assign(extractedDeps(), {
    startPractice: (qs, label, backTo, marathon) => startPractice(qs, label, backTo, marathon),
    showView: (name) => showView(name),
  }));
}

if (QuizUI) {
  QuizUI.init(Object.assign(extractedDeps(), {
    getSession: () => session,
    sourceForQuestion: (q) => Packs.sourceForQuestion(q),
    recordAnswer: (q, right) => recordAnswer(q, right),
    finishSession: (timedOut) => finishSession(timedOut),
    save: () => save(),
    speak: (text) => speak(text),
  }));
}

/** Delegates to js/home-ui.js (absent only if that script failed to load). */
function renderHome() { if (HomeUI) HomeUI.render(); }

/** Delegates to js/flashcards-ui.js (absent only if that script failed to load). */
function renderFlashcards() { if (FlashcardsUI) FlashcardsUI.render(); }
function flipCard() { if (FlashcardsUI) FlashcardsUI.flipCard(); }
function fcMove(d) { if (FlashcardsUI) FlashcardsUI.fcMove(d); }
function fcMark(known) { if (FlashcardsUI) FlashcardsUI.fcMark(known); }
function fcIds() { return FlashcardsUI ? FlashcardsUI.fcIds() : Object.keys(SIGNS); }
function signArt(id, size) { return FlashcardsUI ? FlashcardsUI.signArt(id, size) : signSVG(id, size, ""); }

/** Delegates to js/review-ui.js. */
function renderReview() { if (ReviewUI) ReviewUI.render(); }
function renderFluency() { if (ReviewUI) ReviewUI.renderFluency(); }

/** Delegates to js/results-ui.js; returns the post-mock drill for the session. */
function showResults(r) {
  if (ResultsUI) { ResultsUI.show(r, session); return; }
  showView("results");
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
const FALLBACK_TERMS = {
  agencyShort: "DMV",
  examName: "knowledge test",
  examShort: "written test",
  learnerPermit: "learner's permit",
  regionLabel: "state",
  rulesLabel: "State Rules",
  sourceLabel: "the official driver handbook",
};
const FALLBACK_HAZARD = { includedInExam: false, positioning: "bonus training" };
/* Country follows the selected pack through the jurisdiction registry.
   Keeps terminology, hazard positioning and exam naming data-driven. */
function countryForPack(packId) {
  if (typeof Jur.jurisdictionForRegion === "function") return Jur.jurisdictionForRegion(packId);
  const all = (Jur.JURISDICTIONS) || {};
  const selected = Object.values(all).find((country) =>
    country && country.active && Array.isArray(country.regions) && country.regions.includes(packId)
  );
  if (selected) return selected;
  if (Jur.ACTIVE_COUNTRY && all[Jur.ACTIVE_COUNTRY]) return all[Jur.ACTIVE_COUNTRY];
  return Object.values(all).find((country) => country && country.active) || null;
}
function termsForPack(packId) {
  const c = countryForPack(packId == null ? (typeof state !== "undefined" ? state.settings.statePack : null) : packId);
  return (c && c.terminology) || FALLBACK_TERMS;
}
function hazardInfoForPack(packId) {
  const c = countryForPack(packId == null ? (typeof state !== "undefined" ? state.settings.statePack : null) : packId);
  return (c && c.hazardPerception) || FALLBACK_HAZARD;
}
const APP_VERSION = "1.1.0";
const STORE_KEY = "roadready.v1";
/** @returns {any} element by id — vanilla app, DOM types vary per caller */
const $ = (id) => document.getElementById(id);
const on = (el, ev, fn) => el.addEventListener(ev, fn);

/* ---------------- state ---------------- */
let storageOk = true;
  try { localStorage.setItem("roadready.probe", "1"); localStorage.removeItem("roadready.probe"); }
  catch { storageOk = false; }
if (!storageOk) setTimeout(() => showPersistenceWarning("unavailable"), 0);
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
function showPersistenceWarning(kind) {
  const host = document.getElementById("toasts");
  if (!host) return;
  let el = document.getElementById("storageWarning");
  if (!el) {
    el = document.createElement("div");
    el.id = "storageWarning";
    el.className = "toast warning";
    el.setAttribute("role", "alert");
    host.appendChild(el);
  }
  el.innerHTML = `${icon("alert", 17)}<div><b>Progress is not being saved</b><small>${kind === "quota" ? "Storage is full — export a backup and free browser storage." : kind === "unavailable" ? "Browser storage is unavailable — export a backup if possible." : "The last save could not be completed. Your latest activity may be lost."}</small></div>`;
}
function save() {
  try {
    rawSet(STORE_KEY, JSON.stringify(state));
    const el = document.getElementById("storageWarning");
    if (el) el.remove();
  } catch (e) {
    showPersistenceWarning(e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(String(e && e.message))) ? "quota" : "write");
  }
}
const todayStr = () => Core.localDay(Date.now());
const yesterdayStr = () => Core.localDayBefore(todayStr(), 1);

function touchStreak() {
  const t = todayStr();
  state.streak = Core.touchStreak(state.streak, t, yesterdayStr());
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

/* Optional account + sync.
 *
 * Loaded LAZILY, on the first time the learner opens Settings, not at boot.
 * Two reasons this matters beyond tidiness:
 *
 *   1. Privacy. Calling /api/auth/session on every page load tells the server
 *      when each learner is active, before they have asked for anything
 *      account-shaped. The panel this probes for lives only in Settings, and
 *      is hidden entirely on deployments with no accounts configured.
 *   2. Offline. An offline-first app should not need a round-trip to render
 *      its home screen. Booting from cache is now zero-network by construction.
 *
 * The probe is idempotent: repeat navigations to Settings reuse the first
 * result, so it still costs at most one request per session. */
let accountReady = false;
async function initAccount() {
  if (accountReady) return;
  if (!AccountUI || !window.RoadReadyAccount) return;
  await AccountUI.init({
    account: window.RoadReadyAccount,
    getBundle: () => Core.exportBundle(state),
    parseBundle: (text) => Core.parseImport(text, { packIds: Packs.PACK_IDS }),
    applyState: (nextState) => {
      state = nextState;
      bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
      save();
      renderStateFacts();
      renderHome(); renderStats(); renderFlashcards();
    },
  });
  accountReady = true;
}

const openSettings = () => { void initAccount(); showView("settings"); };

/* ---------------- XP, levels & achievements ---------------- */
const ACHIEVEMENTS = Core.ACHIEVEMENTS;
function levelFor(xp) { return Core.levelFor(xp); }
function toast(title, sub, ic) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  const box = document.createElement("div");
  const head = document.createElement("b");
  head.textContent = title;
  box.appendChild(head);
  if (sub) {
    const small = document.createElement("small");
    small.textContent = sub;
    box.appendChild(small);
  }
  // icon() emits trusted static SVG; title/sub are user-visible strings and
  // are set via textContent so they can never become markup.
  t.innerHTML = `${icon(ic || "award", 17)}`;
  t.appendChild(box);
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
    hazardPct: state.hazardBest ? state.hazardBest / (HZ_SCENARIOS.length * 5) : 0,
    readinessPct: Math.round(readiness() * 100),
    allSignsKnown: fcIds().every(id => state.fcKnown[id]),
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
  } catch { /* speech unavailable — silently ignore */ }
}
function stopSpeaking() {
  if (ttsSupported()) { try { speechSynthesis.cancel(); } catch (e) { console.warn("[road-ready] speech:", e); } }
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
const readiness = () => Core.readiness(bank, state.qstats, state.exams);
const missedQuestions = () => Core.missedQuestions(bank, state.qstats);
const catAccuracy = (cat) => Core.catAccuracy(catQ(cat), state.qstats);
const validTestDate = () => Core.validIsoDate(state.settings.testDate) && Core.daysBetweenLocalDates(todayStr(), state.settings.testDate) >= 0;

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



/* ---------------- SETUP ---------------- */
function startSetup(mode, focusCat) {
  quizBackTarget = "home";
  $("setupTitle").textContent = mode === "practice" ? "Practice" : "Mock Exam";
  const _setupTerms = termsForPack();
  $("setupSub").textContent = mode === "practice" ? "Pick a topic — or drill smart with adaptive mix." : `Timed ${_setupTerms.agencyShort}-style ${_setupTerms.examName} — real exam conditions, no feedback until the end.`;
  const list = $("setupList");
  list.innerHTML = "";
  if (mode === "practice") {
    // Daily set is sized to the test date — never an open-bank dump.
    const unmasteredCount = bank.filter((q) => !state.qstats[q.id] || Core.qMastery(state.qstats[q.id]) < 0.8).length;
    let daysLeftPractice = null;
    if (state.settings.testDate) {
      const diffPractice = Core.daysBetweenLocalDates(todayStr(), state.settings.testDate);
      if (diffPractice != null && diffPractice > 0) daysLeftPractice = diffPractice;
    }
    const todaySize = Math.max(5, Math.min(
      Core.recommendedToday({ unmasteredQuestions: Math.max(1, unmasteredCount), daysUntilTest: daysLeftPractice, dailyGoal: Core.DAILY_GOAL, riskCount: 0 }) || Core.DAILY_GOAL,
      bank.length
    ));
    const items = [
      { id: "today", icon: "sparkles", name: "Today's Set", desc: `${todaySize} questions sized to your test date${daysLeftPractice ? ` — test in ${daysLeftPractice} day${daysLeftPractice === 1 ? "" : "s"}` : " — set a test date for a dated plan"} · weak spots first`, action: () => startPractice(pickWeighted(adaptivePool(), todaySize), "Today's Set", "home") },
      { id: "missed", icon: "target", name: "Missed Questions", desc: missedQuestions().length ? `Re-drill the ${Math.min(todaySize, missedQuestions().length)} you've gotten wrong` : "Nothing missed yet — nice!", action: () => { const m = missedQuestions(); if (m.length) startPractice(pickWeighted(m.map(q => ({ q, w: 1 })), Math.min(todaySize, m.length)), "Missed Questions", "home"); } },
      { id: "flagged", icon: "flag", name: "Flagged Questions", desc: Object.keys(state.flagged).length ? `${Object.keys(state.flagged).length} flagged for review` : "Flag questions during practice to build this set", action: () => { const f = Object.keys(state.flagged).map(id => byId[id]).filter(Boolean); if (f.length) startPractice(shuffle(f).slice(0, 15), "Flagged Questions", "home"); } },
      { id: "marathon", icon: "infinity", name: "Marathon Mode", desc: `${bank.length} questions — the full bank in one run · anything you miss comes back until you've seen it through`, action: () => startMarathon() },
    ];
    const stateQuestions = bank.filter(q => Array.isArray(q.jurisdiction) && q.jurisdiction.includes(state.settings.statePack));
    if (stateQuestions.length) {
      const pack = Packs.STATE_PACKS[state.settings.statePack];
      const terms = termsForPack();
      items.splice(1, 0, {
        id: "state-rules", icon: "scale", name: `${pack.name} · ${terms.rulesLabel}`,
        desc: `${stateQuestions.length} jurisdiction-specific questions · every answer cites ${terms.sourceLabel}`,
        action: () => startPractice(shuffle(stateQuestions), terms.rulesLabel, "home"),
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
    // Official Simulation first: the mock that looks like the real test —
    // same count, same time limit, same pass mark. Generic lengths are extras.
    const packId = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
    const bp = BLUEPRINTS[packId];
    if (bp) {
      const availability = Core.officialExamAvailability(bank, bp);
      if (availability.full) {
        items.push({
          id: "official", icon: "grad", name: bp.label,
          desc: `${bp.questionCount} questions · pass ${bp.minCorrect}/${bp.questionCount} (official threshold) · ${bp.timeLimitMin ? bp.timeLimitMin + "-min limit" : `${Core.timeLimitSecs(bp.questionCount) / 60}-min pacing`} · feedback at end`,
          action: () => startOfficialExam(packId),
        });
      } else {
        items.push({
          id: "official-preview", icon: "grad",
          name: `${bp.label.replace(/ simulation$/i, "")} practice preview`,
          desc: `${availability.available} unique questions available · full official-length simulation needs ${availability.required} · not scored as an official test`,
          action: () => startOfficialPreview(packId),
        });
      }
    }
    items.push(
      { id: "weak", icon: "target", name: "Weak Topics Exam", desc: "20 questions weighted toward your lowest categories (extra practice)", action: () => startExam(20, true) },
      { id: "quick", icon: "zap", name: "Quick Check — 10 questions", desc: `5-minute diagnostic across your selected ${termsForPack().examName} pool (extra practice)`, action: () => startExam(10) },
    );
    items.forEach(it => list.appendChild(setupRow(it)));
    if (!bp) {
      const note = document.createElement("p");
      note.className = "setting-note";
      const terms = termsForPack(packId);
      note.textContent = `Pick your ${terms.regionLabel} pack first (Settings → "Your jurisdiction pack") — the mock exam then matches that test's published count, time and pass mark.`;
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

/**
 * Launch the drill the Adaptive Coach recommended. Each recommendation type
 * maps to a concrete question set — never a generic "practise more". The
 * misconception types prefer concept variants (fresh questions of the same
 * concept) so the RULE is re-tested rather than the question replayed.
 */
function startCoachSession() {
  const plan = Coach.recommend({
    bank,
    qstats: state.qstats,
    exams: state.exams,
    daily: state.daily,
    misconceptions: state.misconceptions,
    categories: CATEGORIES,
    testDate: validTestDate() ? state.settings.testDate : "",
    today: todayStr(),
    nowMs: Date.now(),
    // Hazard perception is a scored section in some jurisdictions; the plan
    // must be able to recommend it there and must ignore it elsewhere.
    hazardPerception: hazardInfoForPack(),
    hazardLog: state.hazardLog,
    hazardCategoryOf: (name) => (HZ_SCENARIOS.find((s) => s.name === name) || {}).category || null,
    hazardCategoryLabel: (cat) => (HazardScenarios && HazardScenarios.categoryLabel
      ? HazardScenarios.categoryLabel(cat) : cat),
    terminology: termsForPack(),
  });
  const r = plan.primary;
  if (!r) { startPractice(pickWeighted(adaptivePool(), 10), "Today's Plan", "home"); return; }
  if (r.type === Coach.REC_TYPES.HAZARD_TRAINING) { showView("hazard"); return; }
  if (r.type === Coach.REC_TYPES.TAKE_MOCK) {
    const packId = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : null;
    if (packId && BLUEPRINTS[packId]) { startOfficialExam(packId); return; }
    startSetup("exam");
    return;
  }
  const missedIds = new Set(missedQuestions().map((q) => q.id));
  let qs = [];
  for (const key of r.conceptKeys) {
    for (const id of Coach.drillIdsForConcept(key, bank, state.qstats, missedIds)) {
      const q = byId[id];
      if (q && !qs.includes(q)) qs.push(q);
    }
    if (qs.length >= r.questionCount) break;
  }
  if (r.type === Coach.REC_TYPES.BUILD_COVERAGE) {
    // coverage work is unseen-first: prefer questions never attempted
    const unseen = bank.filter((q) => !state.qstats[q.id] || !state.qstats[q.id].seen);
    qs = shuffle(unseen).concat(shuffle(qs.filter((q) => !unseen.includes(q))));
  }
  if (qs.length < r.questionCount) {
    const pad = pickWeighted(adaptivePool().filter((p) => !qs.includes(p.q)), r.questionCount - qs.length);
    qs = qs.concat(pad);
  }
  qs = qs.slice(0, Math.max(1, r.questionCount || 10));
  // Learning evidence — ONE event per session (start records the before
  // signals; finishSession closes it with after signals under the same
  // sessionId). The intervention key comes from the shared vocabulary in
  // js/core.js so producers, the evidence engine and the coach ranking all
  // speak the same language.
  const evidenceSessionId = `ev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  if (Evidence) {
    const before = {
      conceptMastery: r.evidence && r.evidence.length && r.evidence[0].mastery != null ? r.evidence[0].mastery : null,
      accuracy: r.evidence && r.evidence.length && r.evidence[0].accuracy != null ? r.evidence[0].accuracy : null,
      misconceptions: Coach.activeMisconceptions(state.misconceptions).length,
      overdue: (r.evidence || []).reduce((t, e) => t + (e.overdue || 0), 0),
    };
    state.coachEvents = Evidence.recordRecommendation(state.coachEvents, {
      sessionId: evidenceSessionId,
      type: r.type,
      intervention: Core.interventionFor(r.type, r.escalated === true),
      followed: true, // the learner STARTED the recommended work (completion
                      // is measured by the closing event's during/after block)
      kind: r.type === Coach.REC_TYPES.TAKE_MOCK ? "mock" : r.type === Coach.REC_TYPES.REVIEW_OVERDUE ? "review" : "practice",
      conceptKeys: r.conceptKeys,
      jurisdiction: state.settings.statePack,
      before,
    }, Date.now());
    save();
  }
  session = {
    mode: "practice", label: r.title, questions: shuffle(qs), i: 0, correct: 0,
    answers: [], endTs: 0, timerId: null, marathon: false, requeued: {},
    evidenceSessionId, // lets finishSession close the evidence loop
  };
  quizBackTarget = "home";
  beginQuiz();
}

function startPractice(questions, label, backTo, marathon) {
  if (!questions.length) return;
  quizBackTarget = backTo || "home";
  session = { mode: "practice", label, questions, i: 0, correct: 0, answers: [], endTs: 0, timerId: null, marathon: !!marathon, requeued: {} };
  beginQuiz();
}
/* Marathon Mode: the full active-jurisdiction bank in one run. Missed
   questions are requeued by the quiz UI until answered correctly, and the
   "Marathoner" achievement fires at 100+ answers in the session. */
function startMarathon() {
  if (!bank.length) return;
  startPractice(shuffle(bank.slice()), "Marathon — full bank", "setup", true);
}
function startExam(n, weakBias) {
  quizBackTarget = "home";
  // Blueprint-stratified assembly: every mock mirrors the real test's topic
  // mix; weakBias reserves ~60% of seats for your three weakest topics.
  const qs = Core.assembleExam({
    bank, n, qstats: state.qstats, flags: state.flagged, weakBias,
    samplingMode: "adaptive",
    recentlySeen: state.qstats,
  });
  session = { mode: "exam", label: n >= 40 ? "Full Test" : n > 12 ? "Mock Exam" : "Quick Check", questions: qs, i: 0, correct: 0, answers: [], timeLeft: Core.timeLimitSecs(qs.length), endTs: 0, timerId: null };
  beginQuiz();
}

/* Incomplete jurisdiction banks get a clearly non-official practice preview.
   Never award an official-standard pass until enough UNIQUE questions exist
   to assemble the jurisdiction's full published question count. */
function startOfficialPreview(packId) {
  const bp = BLUEPRINTS[packId];
  if (!bp) return;
  const availability = Core.officialExamAvailability(bank, bp);
  if (!availability.available) return;
  const qs = Core.assembleExam({
    bank,
    n: availability.available,
    samplingMode: "representative",
    weights: bp.topicWeights,
  });
  toast(
    "Practice preview",
    `${availability.available}/${availability.required} unique questions available. This is not an official-length mock.`,
    "grad"
  );
  startPractice(qs, `${bp.label.replace(/ simulation$/i, "")} practice preview`, "setup");
}

/* Official Simulation — locked to the jurisdiction's real exam parameters.
   Pool: universal + this state's questions only. Feedback stays hidden until
   the end; pass bar and pacing come from EXAM_BLUEPRINTS, not settings. */
function startOfficialExam(packId) {
  const bp = BLUEPRINTS[packId];
  if (!bp) return;
  const availability = Core.officialExamAvailability(bank, bp);
  if (!availability.full) {
    startOfficialPreview(packId);
    return;
  }
  quizBackTarget = "home";
  const qs = Core.assembleExam({
    bank, n: bp.questionCount, samplingMode: "representative", weights: bp.topicWeights,
    recentlySeen: state.qstats,
  });
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
function escapeHTML(s) { return Format.escapeHTML ? Format.escapeHTML(s) : s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function sourceCitationHTML(q) {
  const source = Packs.sourceForQuestion(q);
  if (!source) return "";
  const detail = q.sourceSection ? `${source.agency} · ${q.sourceSection}` : source.title;
  const label = source.citationLabel || "Official source";
  // composite sources cite many documents and may have no single URL
  if (!source.url) return `<span class="source-link">${escapeHTML(label)}: ${escapeHTML(detail)}</span>`;
  return `<a class="source-link" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}: ${escapeHTML(detail)} ↗</a>`;
}

/* Quiz rendering + answer feedback live in js/quiz-ui.js; this file keeps the
 * session lifecycle (start/finish/scoring). */
function renderTimer() { if (QuizUI) QuizUI.renderTimer(); }
function renderQuiz() { if (QuizUI) QuizUI.renderQuiz(); }

function recordAnswer(q, right) {
  const now = Date.now();
  const s = state.qstats[q.id] || (state.qstats[q.id] = { seen: 0, correct: 0, wrong: 0 });
  s.seen++; right ? s.correct++ : s.wrong++;
  s.lastSeen = now;
  if (!right) s.lastWrong = now;
  // Spaced-retrieval evidence: the distinct days this question was answered
  // correctly, so concept mastery can distinguish "once" from "across days".
  Core.noteRetrieval(s, right, now);
  s.sched = Core.reviewSched(s.sched, right, now);   // weak-topic resurfacing
  // Misconception ledger: wrong answers open/escalate a concept case in every
  // mode (practice AND mock); correct answers are repair evidence — one lucky
  // repeat of the same question proves nothing, a variant does (see Coach).
  const conceptKey = Core.conceptKeyOf(q);
  if (right) {
    if (state.misconceptions[conceptKey]) {
      state.misconceptions = Coach.noteConceptSuccess(state.misconceptions, conceptKey, q.id, now);
    }
  } else {
    state.misconceptions = Coach.recordMisconception(state.misconceptions, conceptKey, q.id, now);
  }
  // Answer fluency: classify against the learner's own response-time distribution.
  const elapsed = session.shownAt ? now - session.shownAt : null;
  state.rtSamples = Core.pushRtSample(state.rtSamples, elapsed);
  Core.applyFluency(s, Core.classifyResponse(elapsed, right, Core.rtPercentiles(state.rtSamples)));
  session.shownAt = 0;
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
  // Learning evidence: close the loop on a followed coach session — UPDATE the
  // session's single event (same sessionId) with the real outcome signals, so
  // before→after pairs are genuine and one session is never double-counted.
  if (Evidence && session.evidenceSessionId) {
    const answers = session.answers || [];
    const accuracy = answers.length ? answers.filter((a) => a.right).length / answers.length : null;
    const idx = state.coachEvents.findIndex((e) => e && e.sessionId === session.evidenceSessionId);
    if (idx >= 0) {
      const prev = state.coachEvents[idx];
      const during = Object.assign({}, prev.during || {}, {
        accuracy: accuracy == null ? (prev.during || {}).accuracy : accuracy,
      });
      const after = {
        conceptMastery: null, // per-concept mastery is measured by the map at read time
        accuracy: accuracy == null ? null : accuracy,
        misconceptions: Coach.activeMisconceptions(state.misconceptions).length,
        overdue: Coach.conceptDiagnosis(bank, state.qstats, Date.now()).reduce((t, d) => t + d.overdue, 0),
        coveragePct: Math.round(Core.bankCoverage(bank, state.qstats) * 100),
      };
      state.coachEvents = state.coachEvents.slice();
      state.coachEvents[idx] = Object.assign({}, prev, { during, after });
      save();
    }
    session.evidenceSessionId = null;
  }
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
    const pass = g.pass && (!bp || total === bp.questionCount);
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
          ? (total < bp.questionCount
            ? `You cleared the ${Math.round(100 * bp.minCorrect / bp.questionCount)}% bar on this ${total}-question starter run. Real test: ${bp.minCorrect} of ${bp.questionCount}. ${bp.notes}`
            : `You met ${bp.label.replace(" Simulation", "")}'s real bar: ${bp.minCorrect} of ${bp.questionCount}. ${bp.notes}`)
          : `You scored above the ${Math.round(state.settings.passMark * 100)}% pass mark. Take another exam to build consistency.`
        : bp
          ? (total < bp.questionCount
            ? `The real ${bp.label.replace(" Simulation", "")} requires ${bp.minCorrect} of ${bp.questionCount} — this starter run covered ${total}. Review your misses and try again.`
            : `The real ${bp.label.replace(" Simulation", "")} requires ${bp.minCorrect} of ${bp.questionCount}. Review your misses and try again.`)
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
function toggleFlag() { if (QuizUI) QuizUI.toggleFlag(); }

/* ---------------- STATS & CALIBRATION ----------------
 * Rendering and wiring live in js/stats-ui.js; the learning logic stays in
 * core.js / coach.js / mastery.js / evidence.js. This file only orchestrates.
 * (StatsUI itself is declared with the other UI bindings near the top.) */
function renderStats() { if (StatsUI) StatsUI.render(); }
function renderCalibration() { if (StatsUI) StatsUI.renderCalibration(); }
function predictionCalibrationSamples() { return StatsUI ? StatsUI.predictionCalibrationSamples() : []; }
function freezeOfficialPrediction() { return StatsUI ? StatsUI.freezeOfficialPrediction() : null; }
function pendingOutcomePrediction() { return StatsUI ? StatsUI.pendingOutcomePrediction() : null; }
function logOutcome(result) { if (StatsUI) StatsUI.logOutcome(result); }
const CALIBRATION_CONTEXT = () => (StatsUI ? StatsUI.CALIBRATION_CONTEXT() : { jurisdiction: "generic", engineVersion: Core.MASTERY_VERSION });
function buildCalibrationCurve(samples) { return StatsUI ? StatsUI.buildCalibrationCurve(samples) : null; }

/* ---------------- learner study (research) ---------------- */


/* ---------------- HAZARD PERCEPTION ----------------
 * Scenario bank + scene drawing live in js/hazard-scenarios.js; the game UI in
 * js/hazard-ui.js. This file only wires the home card and stats labels. */
const HazardUI = window.RoadReadyHazardUI;
const HazardScenarios = (typeof window !== "undefined" ? window.RoadReadyHazardScenarios : null)
  || (typeof globalThis !== "undefined" ? globalThis.RoadReadyHazardScenarios : null);
const HZ_SCENARIOS = (HazardScenarios && HazardScenarios.scenarios) || [];
if (HazardUI) {
  HazardUI.init({
    Core,
    Scenarios: HazardScenarios,
    getState: () => state,
    save: () => save(),
    showView: (name) => showView(name),
    toast,
    icon,
    addXP,
    unlock,
    checkProgressAchievements,
    hazardInfoForPack: () => hazardInfoForPack(),
    termsForPack: () => termsForPack(),
    renderHome: () => renderHome(),
    escapeHTML,
  });
}
function hzStartGame() { if (HazardUI) HazardUI.start(); }

/* ---------------- theme ---------------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  $("btnTheme").innerHTML = icon(state.settings.theme === "dark" ? "sun" : "moon", 17);
}

/* ---------------- ONBOARDING ---------------- */
let obStep = 0;
function initObStatePack() {
  const sel = $("obStatePack");
  if (!sel || sel.options.length) return;
  const tree = (Jur.jurisdictionTree) ? Jur.jurisdictionTree({
    STATE_PACKS: Packs.STATE_PACKS,
    EXAM_BLUEPRINTS: BLUEPRINTS,
    SOURCE_REGISTRY: Packs.SOURCE_REGISTRY || {},
  }) : [];
  const addOption = (host, value, text) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    host.appendChild(o);
  };
  if (tree.length) {
    for (const c of tree) {
      const g = document.createElement("optgroup");
      const terms = (c.terminology) || {};
      g.label = `${c.name} — ${terms.agencyShort || ""}`.trim();
      if (c.id === "us") addOption(g, "generic", "General U.S. rules (no state yet)");
      for (const r of c.regions || []) addOption(g, r.id, r.name);
      sel.appendChild(g);
    }
  } else {
    addOption(sel, "generic", "General U.S. rules (no state yet)");
    Packs.PACK_IDS.filter((id) => id !== "generic").forEach((id) => {
      addOption(sel, id, Packs.STATE_PACKS[id].name);
    });
  }
  sel.value = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
  on(sel, "change", (e) => {
    state.settings.statePack = e.target.value;
    save();
    bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
    const main = $("selStatePack");
    if (main) main.value = state.settings.statePack;
    renderStateFacts();
    renderHome();
  });
}
function showOnboarding() {
  const ob = $("onboarding");
  ob.hidden = false;
  obStep = 0;
  hydrateIcons(ob);
  initObStatePack();
  const obSel = $("obStatePack");
  if (obSel) obSel.value = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : "generic";
  const obDate = $("obTestDate");
  if (obDate) {
    obDate.value = state.settings.testDate || "";
    on(obDate, "change", (e) => {
      state.settings.testDate = Core.validIsoDate(e.target.value) ? e.target.value : "";
      save();
      const main = $("inpTestDate");
      if (main) main.value = state.settings.testDate || "";
      renderHome();
    });
  }
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
  const obDate = $("obTestDate");
  if (obDate && Core.validIsoDate(obDate.value)) {
    state.settings.testDate = obDate.value;
    const main = $("inpTestDate");
    if (main) main.value = state.settings.testDate;
  }
  save();
  bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
  $("onboarding").hidden = true;
  renderStateFacts();
  renderHome();
  const pack = Packs.STATE_PACKS[state.settings.statePack] || Packs.STATE_PACKS.generic;
  const terms = termsForPack();
  const country = countryForPack();
  const scopeNote = pack.includeUniversal === false
    ? `Studying ${country ? country.name : pack.name} ${terms.rulesLabel.toLowerCase()} for the ${terms.agencyShort} ${terms.examName}. Start with Today's Set.`
    : `Studying ${pack.name} rules + universal rules. Start with Today's Set.`;
  toast("Welcome aboard", scopeNote, "car");
}

/* ---------------- wire up ---------------- */
function init() {
  applyTheme();
  hydrateIcons(document);
  applyTTS();
  initStatePackSelect();
  renderStateFacts();
  initGuideFinder();
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

  // hazard perception: #fcHazard starts the training; the module owns #hzSlow,
  // #hzQuit and the Space key handler once rendered.
  on($("fcHazard"), "click", hzStartGame);

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
    // Post-mock: the primary action is the targeted drill built from the
    // concepts missed — not a blind replay of the same mock.
    if (session && session.lastDrill && session.lastDrill.questions.length) {
      startPractice(shuffle(session.lastDrill.questions), session.lastDrill.label, "home");
      return;
    }
    if (session && session.official && session.blueprint) {
      const packId = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : null;
      if (packId && BLUEPRINTS[packId]) { startOfficialExam(packId); return; }
    }
    if (session && session.mode === "exam") startExam(session.questions.length);
    else startPractice(pickWeighted(adaptivePool(), session ? session.questions.length : 10), "Today's Set", "home");
  });
  on($("btnReviewMissed"), "click", () => { renderReview(); showView("review"); });
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
      else if (t === "guide") { renderStateFacts(); showView("guide"); }
      else if (t === "stats") { renderStats(); showView("stats"); }
      else { renderHome(); showView("home"); }
    });
  });
  // hero quick actions
  on($("qaPractice"), "click", () => startSetup("practice"));
  on($("qaExam"), "click", () => startSetup("exam"));
  on($("qaCards"), "click", () => { renderFlashcards(); showView("flashcards"); });
  on($("qaPractical"), "click", () => { renderPractical(); showView("practical"); });
  if (PracticalUI) {
    PracticalUI.buildForm();
    on($("btnSaveSession"), "click", () => PracticalUI.saveSession());
  }
  on($("qaReview"), "click", () => {
    // The home "Weaknesses" action opens the Weakness Centre — grouped,
    // solvable problems with their own action set — rather than silently
    // starting a drill the learner did not choose.
    renderReview();
    showView("review");
  });
  on($("btnPlanDate"), "click", () => {
    void initAccount();
    showView("settings");
    setTimeout(() => { $("inpTestDate").scrollIntoView({ block: "center" }); $("inpTestDate").focus(); }, 0);
  });
  on($("btnPlanAction"), "click", e => {
    const action = e.currentTarget.dataset.action;
    if (action === "set-date") {
      void initAccount();
      showView("settings");
      setTimeout(() => { $("inpTestDate").scrollIntoView({ block: "center" }); $("inpTestDate").focus(); }, 0);
      return;
    }
    if (action === "review") {
      const missed = missedQuestions();
      const size = Math.min(12, Math.max(4, missed.length));
      if (missed.length) {
        startPractice(pickWeighted(missed.map(q => ({ q, w: 1 })), size), "Test Day Review", "home");
        return;
      }
      startPractice(pickWeighted(adaptivePool(), size), "Test Day Review", "home");
      return;
    }
    if (action === "coach") {
      startCoachSession();
      return;
    }
    if (action === "exam") {
      const packId = Packs.PACK_IDS.includes(state.settings.statePack) ? state.settings.statePack : null;
      if (packId && BLUEPRINTS[packId]) { startOfficialExam(packId); return; }
      startSetup("exam"); return;
    }
    const plan = Core.studyPlan(bank, state.qstats, state.exams, state.daily, state.settings.testDate, todayStr());
    const size = Math.min(Math.max(plan.dailyTarget, 5), bank.length);
    startPractice(pickWeighted(adaptivePool(), size), "Today's Plan", "home");
    void plan;
  });

  // flashcards
  on($("flashcard"), "click", flipCard);
  on($("flashcard"), "keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); } });
  on($("btnFcPrev"), "click", () => fcMove(-1));
  on($("btnFcNext"), "click", () => fcMove(1));
  on($("btnFcYes"), "click", () => fcMark(true));
  on($("btnFcNo"), "click", () => fcMark(false));
  on($("btnFcShuffle"), "click", () => { if (FlashcardsUI) FlashcardsUI.shuffleDeck(); });
  on($("btnFcReset"), "click", () => { if (FlashcardsUI) FlashcardsUI.resetDeck(); });

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
    const terms = termsForPack(e.target.value);
    const country = countryForPack(e.target.value);
    const scopeMsg = pack.includeUniversal === false
      ? `${n} ${terms.rulesLabel} questions · ${country ? country.name : pack.name} only · key rules updated`
      : n ? `${n} jurisdiction-specific questions added · key rules updated` : "Universal questions — confirm local details with official sources.";
    toast("Pack: " + pack.name, scopeMsg, "car");
  });
  on($("btnExport"), "click", exportProgress);
  /* The account probe is deferred to the first Settings visit rather than run at
     boot, so rendering the home screen from cache needs no network at all. */
  on($("btnOpenSettings"), "click", openSettings);
  on($("btnSettingsDone"), "click", () => { renderStats(); showView("stats"); });
  on($("btnOutcomePass"), "click", () => {
    let pending = pendingOutcomePrediction();
    if (!pending) pending = freezeOfficialPrediction();
    if (!confirm(`Freeze this pre-test snapshot (${pending.readinessPct}% readiness, ${pending.coveragePct}% coverage), then log that you PASSED your real test?`)) return;
    logOutcome("pass");
  });
  on($("btnFreezePrediction"), "click", () => {
    if (pendingOutcomePrediction()) {
      toast("Prediction already frozen", "Record your real result when it arrives.", "chart");
      return;
    }
    const p = freezeOfficialPrediction();
    renderCalibration();
    toast("Prediction frozen", `Readiness ${p.readinessPct}% · coverage ${p.coveragePct}% · evidence ${p.evidenceClass}.`, "chart");
  });
  on($("btnStudyJoin"), "click", () => { if (StudyUI) StudyUI.join(); });
  on($("btnDiagnostic"), "click", startDiagnostic);
  on($("btnRetentionProbes"), "click", startRetentionProbes);
  on($("btnStudyExport"), "click", () => { if (StudyUI) StudyUI.exportData(); });
  on($("btnOutcomeFail"), "click", () => {
    let pending = pendingOutcomePrediction();
    if (!pending) pending = freezeOfficialPrediction();
    if (!confirm(`Freeze this pre-test snapshot (${pending.readinessPct}% readiness, ${pending.coveragePct}% coverage), then log that you DID NOT pass?`)) return;
    logOutcome("fail");
  });
  on($("btnImport"), "click", () => $("fileImport").click());
  on($("fileImport"), "change", e => {
    const f = e.target.files && e.target.files[0];
    if (f) importProgress(f);
    e.target.value = "";
  });
  /* ---- local data deletion ----
   *
   * Local-only storage makes the learner the database, so "erase" has to be
   * complete and explicit about its scope. Two behaviours matter:
   *
   *   1. The confirm enumerates what actually goes, not just "progress". A
   *      learner who logged supervised Drive Log sessions is writing real
   *      personal notes, and those must be named before they are destroyed.
   *   2. There is an export-then-erase path, so the destructive action is
   *      never the only way to make room.
   *
   * Sign-out is intentionally NOT a deletion: it ends the account session and
   * leaves this device untouched, which is stated in the settings text so the
   * common misconception is closed rather than merely avoided. */
  function eraseLocalProgress() {
    if (!confirm(
      "Erase ALL of the following from this device? This cannot be undone.\n\n"
      + "• question, mastery and review history\n"
      + "• exam results, mock history and score snapshots\n"
      + "• day streak, study time and XP\n"
      + "• flagged questions and sign-flashcard tracking\n"
      + "• hazard best score\n"
      + "• outcome journal and pre-test predictions\n"
      + "• Drive Log sessions and instructor notes\n"
      + "• research study participation\n\n"
      + "Export first if you want a copy.")) return;
    const theme = state.settings.theme;
    state = Core.defaultState();
    // Preferences that must survive a wipe so the app still opens correctly;
    // everything else in the previous state is deliberately dropped.
    state.settings.theme = theme;
    bank = Packs.filterBankForPack(ALL_QUESTIONS, state.settings.statePack);
    save(); renderStateFacts(); renderStats(); renderHome(); renderFlashcards();
    alert("Erased. This device now has no study history.");
  }

  on($("btnResetAll"), "click", () => eraseLocalProgress());
  // Export first, then confirm the erase separately. The bundle is serialised
  // before anything is destroyed, so a build failure aborts the whole action
  // rather than leaving someone with neither their data nor a backup.
  on($("btnExportThenReset"), "click", () => {
    let bundle;
    try {
      // Serialising is the part that can genuinely fail (a bad state field, a
      // quota error on a huge history). The browser download afterwards is
      // fire-and-forget, which is why the erase still asks for confirmation.
      bundle = JSON.stringify(Core.exportBundle(state));
      if (!bundle || bundle.length < 2) throw new Error("empty bundle");
    } catch {
      alert("Could not build the backup file, so nothing was erased.");
      return;
    }
    exportProgress();
    if (!confirm("Backup downloaded. Erase all progress on this device now?")) return;
    eraseLocalProgress();
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
    }
    // view-hazard keyboard handling lives in js/hazard-ui.js (Space to react)
  });

  showView("home");
}

/* state pack selector (settings) — one optgroup per shipped country (US + UK) */
function initStatePackSelect() {
  const sel = $("selStatePack");
  if (!sel) return;
  sel.innerHTML = "";
  const tree = (Jur.jurisdictionTree) ? Jur.jurisdictionTree({
    STATE_PACKS: Packs.STATE_PACKS,
    EXAM_BLUEPRINTS: BLUEPRINTS,
    SOURCE_REGISTRY: Packs.SOURCE_REGISTRY || {},
  }) : [];
  if (tree.length) {
    for (const c of tree) {
      const g = document.createElement("optgroup");
      const terms = (c.terminology) || {};
      g.label = `${c.name} — ${terms.agencyShort || ""}`.trim();
      if (c.id === "us") {
        const generic = document.createElement("option");
        generic.value = "generic";
        generic.textContent = "General U.S. rules";
        g.appendChild(generic);
      }
      for (const r of c.regions || []) {
        const o = document.createElement("option");
        o.value = r.id;
        o.textContent = r.name + (r.exam ? ` · ${r.exam.questionCount}q` : "");
        o.dataset.exam = r.exam ? JSON.stringify(r.exam) : "";
        g.appendChild(o);
      }
      sel.appendChild(g);
    }
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

/* ---------------- RULE FINDER (study-guide search) ---------------- */
// The query is session-local on purpose: searching never touches stored
// state, so there is nothing to persist, export or erase.
let guideQuery = "";
let guideFinderBound = false;
let guideFinderLast = { questions: [], signs: [] };
function signCopyFor(id) {
  const s = (typeof SIGNS !== "undefined" && SIGNS[id]) || null;
  if (!s) return { name: "", meaning: "" };
  const alt = s.alt && s.alt[state.settings.statePack];
  return alt ? { name: alt.name || s.name, meaning: alt.meaning || s.meaning } : { name: s.name, meaning: s.meaning };
}
function renderGuideFinder() {
  const input = $("ruleSearch"), meta = $("ruleSearchMeta"), host = $("ruleSearchResults");
  if (!input || !meta || !host) return;
  if (document.activeElement !== input && input.value !== guideQuery) input.value = guideQuery;
  const q = guideQuery.trim();
  if (q.length < 2) { meta.hidden = true; host.replaceChildren(); guideFinderLast = { questions: [], signs: [] }; return; }
  const labelFor = (k) => (Coach && Coach.conceptLabel ? Coach.conceptLabel(k) : k);
  const questions = Core.searchBank(bank, q, { labelFor });
  const signs = Core.searchSigns(typeof SIGNS !== "undefined" ? SIGNS : {}, q);
  guideFinderLast = { questions, signs };
  meta.hidden = false;
  if (!questions.length && !signs.length) {
    meta.textContent = `No matches for “${q}” in this jurisdiction's bank — try a shorter word like “overtake”, “signal” or “limit”.`;
    host.replaceChildren();
    return;
  }
  const bits = [];
  if (questions.length) bits.push(`${questions.length} question${questions.length === 1 ? "" : "s"}`);
  if (signs.length) bits.push(`${signs.length} sign${signs.length === 1 ? "" : "s"}`);
  meta.textContent = `${bits.join(" · ")} match “${q}”.`;
  host.replaceChildren();
  if (questions.length) {
    const bar = document.createElement("div");
    bar.className = "finder-bar";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn primary finder-practice";
    btn.textContent = `Practice these ${Math.min(15, questions.length)}`;
    on(btn, "click", () => {
      const qs = guideFinderLast.questions.map(r => r.q);
      if (qs.length) startPractice(shuffle(qs).slice(0, 15), "Rule search", "guide");
    });
    bar.appendChild(btn);
    host.appendChild(bar);
  }
  signs.forEach(({ id }) => {
    const copy = signCopyFor(id);
    const card = document.createElement("div");
    card.className = "card finder-sign";
    const art = document.createElement("div");
    art.className = "sign-frame small";
    art.innerHTML = signArt(id, 64);
    const body = document.createElement("div");
    const name = document.createElement("div");
    name.className = "ri-q";
    name.textContent = copy.name;
    const meaning = document.createElement("div");
    meaning.className = "ri-why";
    meaning.textContent = copy.meaning;
    body.append(name, meaning);
    card.append(art, body);
    host.appendChild(card);
  });
  questions.forEach(({ q: item }) => {
    const card = document.createElement("div");
    card.className = "card finder-item";
    const title = document.createElement("div");
    title.className = "ri-q";
    title.textContent = item.q;
    card.appendChild(title);
    const ans = document.createElement("div");
    ans.className = "ri-a ok";
    ans.textContent = item.choices[item.a];
    card.appendChild(ans);
    const why = document.createElement("div");
    why.className = "ri-why";
    why.textContent = item.why;
    card.appendChild(why);
    const cite = document.createElement("div");
    cite.innerHTML = sourceCitationHTML(item);
    card.appendChild(cite);
    host.appendChild(card);
  });
}
function initGuideFinder() {
  if (guideFinderBound) return;
  const input = $("ruleSearch");
  if (!input) return;
  guideFinderBound = true;
  on(input, "input", () => { guideQuery = input.value; renderGuideFinder(); });
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
  const country = countryForPack(packId);
  if (Guide && typeof Guide.apply === "function") {
    Guide.apply({ country });
  }
  const n = (pack.questions || []).length;
  const rows = Object.entries(pack.facts).map(([k, v]) => {
    const label = FACT_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
    return `<div class="fact-row"><span>${label}</span><b>${v}</b></div>`;
  }).join("");
  host.hidden = false;
  renderGuideFinder();
  const note = pack.note || (source ? `Rules and figures are mapped to the ${source.title}. Laws can change, so confirm before test day.` : "");
  host.innerHTML = `
    <h2 class="section-title">${pack.name}</h2>
    <div class="card state-facts-card">
      <p class="state-note">${escapeHTML(note)}</p>
      <div class="facts-grid">${rows}</div>
      ${n ? `<p class="state-qcount">${n} ${packId}-specific questions are included in your practice and exams.</p>` : ""}
      ${source ? `<a class="source-link state-source" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">Open ${escapeHTML(source.title)} ↗</a>` : ""}
    </div>`;
}

/* PWA: offline-first service worker with explicit update activation.
 *
 * sw.js uses a generated cache version, so any deployed change installs a new
 * worker. When that worker finishes installing we ask it to skip waiting, and
 * once it takes control we offer a Reload toast instead of silently mixing
 * old markup with new cached assets. */
function showUpdateToast() {
  const host = document.getElementById("toasts");
  if (!host || document.getElementById("swUpdateToast")) return;
  const el = document.createElement("div");
  el.id = "swUpdateToast";
  el.className = "toast";
  el.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = "Road Ready was updated — reload for the latest version.";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn ghost";
  btn.textContent = "Reload";
  on(btn, "click", () => location.reload());
  el.append(text, btn);
  host.appendChild(el);
}
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // file:// has no SW; only register when served over http(s)
  if (!/^https?:$/.test(location.protocol)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  let updateAnnounced = false;
  const activateNow = (worker) => { if (worker) worker.postMessage("skip-waiting"); };
  navigator.serviceWorker.register("sw.js").then((reg) => {
    // An update that finished installing while this tab was closed/open.
    if (reg.waiting && navigator.serviceWorker.controller) activateNow(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // Take over only when a controller already exists: the very first
        // install should activate quietly, without offering a pointless reload.
        if (installing.state === "installed" && navigator.serviceWorker.controller) activateNow(installing);
      });
    });
  }).catch(err => console.warn("[road-ready] SW:", err));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || updateAnnounced) return;
    updateAnnounced = true;
    showUpdateToast();
  });
}

init();
