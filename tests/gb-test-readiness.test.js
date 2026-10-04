/* GB test-readiness regressions.
 *
 * Each block below pins a defect found by auditing the learn -> practise ->
 * diagnose -> repair -> simulate -> improve loop against the real Great
 * Britain test. They are deliberately written as behaviour a learner would
 * notice, not as unit tests of the implementation.
 *
 *  1. Hazard copy must not contradict the scored rule (DVSA gives 0 for an
 *     early click, so "earlier = more points" trains the wrong instinct).
 *  2. The bank's curated `distractors` tags must reach the runtime repair
 *     flow, which previously ignored them entirely.
 *  3. Concept mastery must be REACHABLE for the narrow concepts that make up
 *     97% of the GB bank, without going soft on concepts that offer transfer.
 *  4. Hazard perception is a scored section in GB and must be able to enter
 *     the plan — and must stay out of it where the exam does not score it.
 *  5. The readiness figure must state that it does not cover the hazard
 *     section, rather than silently overstating what has been proved.
 */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import Mastery from "../js/mastery.js";
import Explain from "../js/explain.js";
import Coach from "../js/coach.js";
import Jur from "../js/jurisdictions.js";
import UK from "../js/packs/uk.js";
import Scenarios from "../js/hazard-scenarios.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DAY = Core.DAY_MS;
const GB_QUESTIONS = UK.questions;
const GB_HP = Jur.JURISDICTIONS.uk.hazardPerception;
const US_HP = Jur.JURISDICTIONS.us.hazardPerception;

/* ------------------------------------------------------------------ *
 * 1. Hazard instructions must match the rule the exam actually scores *
 * ------------------------------------------------------------------ */
describe("hazard instruction is jurisdiction-honest", () => {
  it("the GB module declares that clicking early scores zero", () => {
    // DVSA scores a clip 0 when the screen is clicked before the hazard
    // develops. A module that does not say so cannot stop the UI implying
    // that earlier is better.
    expect(GB_HP.includedInExam).toBe(true);
    expect(GB_HP.scoring).toBeTruthy();
    expect(GB_HP.scoring.earlyClick).toBe("scores-zero");
    expect(GB_HP.scoring.lateClick).toBe("scores-zero");
    expect(GB_HP.scoring.instruction).toMatch(/too early/i);
    expect(GB_HP.scoring.instruction).toMatch(/too late/i);
  });

  it("no shipped screen tells a learner that earlier scores more", () => {
    // The regression that motivated this: the hazard subtitle said
    // "Earlier = more points", directly contradicting both the app's own
    // scoring function (hazardScore returns 0 for an early click) and the
    // DVSA rule.
    const files = ["js/hazard-ui.js", "js/hazard-scenarios.js", "index.html"];
    for (const rel of files) {
      const src = readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");
      expect(src, rel).not.toMatch(/earlier\s*=\s*more points/i);
    }
  });

  it("the scored wording is used for GB and not for bonus training", () => {
    const src = readFileSync(fileURLToPath(new URL("../js/hazard-ui.js", import.meta.url)), "utf8");
    // The copy branches on the jurisdiction rather than hardcoding GB.
    expect(src).toMatch(/includedInExam/);
    expect(src).toMatch(/hzInfo\.scoring/);
  });

  it("hazard scoring itself still returns zero for an early click", () => {
    const s = Core.hazardScore(1.0, 3, 5);
    expect(s.band).toBe("early");
    expect(s.pts).toBe(0);
    expect(Core.hazardScore(null, 3, 5).pts).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Curated distractor tags must reach the runtime                   *
 * ------------------------------------------------------------------ */
describe("curated distractor traps drive misconception repair", () => {
  it("every distractor tag used by the GB bank has plain-English copy", () => {
    const tags = new Set();
    for (const q of GB_QUESTIONS) {
      for (const tag of Object.values(q.distractors || {})) tags.add(tag);
    }
    expect(tags.size).toBeGreaterThan(0);
    for (const tag of tags) {
      const trap = Explain.DISTRACTOR_TRAPS[tag];
      expect(trap, `no copy registered for trap "${tag}"`).toBeTruthy();
      expect(trap.label, tag).toBeTruthy();
      expect(trap.hint, tag).toBeTruthy();
    }
  });

  it("a curated trap outranks the timing heuristic", () => {
    const q = GB_QUESTIONS.find((x) => x.id === "uk-366");
    const picked = Number(Object.keys(q.distractors)[0]);
    const trap = Explain.distractorTrap(q, picked);
    expect(trap.tag).toBeTruthy();
    // Even with evidence that would read as "rushed", the bank's own label
    // wins, because it states WHICH misunderstanding was written into the
    // choice rather than inferring one from response time.
    const m = Explain.classifyMistakeWithTrap({
      q, pickedIdx: picked, stat: { seen: 5, correct: 0, wrong: 1, fastWrong: 1 },
      rtMs: 3000, pct: { p50: 5000, p75: 12000 }, similarIds: [],
    });
    expect(m.curated).toBe(true);
    expect(m.tag).toBe(trap.tag);
    expect(m.hint).toBe(trap.hint);
  });

  it("the UK-vs-US trap is called out for a GB learner", () => {
    const trap = Explain.DISTRACTOR_TRAPS["uk-vs-us-rule"];
    expect(trap).toBeTruthy();
    expect(trap.hint).toMatch(/United States|not apply here|does not apply/i);
  });

  it("questions with no tag still fall back to the heuristic taxonomy", () => {
    const untagged = GB_QUESTIONS.find((x) => !x.distractors || !Object.keys(x.distractors).length);
    expect(untagged).toBeTruthy();
    const m = Explain.classifyMistakeWithTrap({
      q: untagged, pickedIdx: 1, stat: { seen: 3, correct: 1, wrong: 2 },
      rtMs: 9000, pct: { p50: 5000, p75: 12000 }, similarIds: [],
    });
    expect(m.curated).toBe(false);
    expect(m.kind).toBeTruthy();
    expect(m.hint).toBeTruthy();
  });

  it("the correct answer is never reported as a distractor trap", () => {
    for (const q of GB_QUESTIONS) {
      for (const idx of Object.keys(q.distractors || {})) {
        expect(Number(idx), q.id).not.toBe(q.a);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * 3. Mastery must be reachable for narrow concepts                   *
 * ------------------------------------------------------------------ */
describe("mastery states are reachable for single-question concepts", () => {
  const one = { id: "solo", cat: "signs", concept: "solo-concept", form: "recall", choices: ["a", "b"], a: 0, why: "because" };

  function soloStats(days, mutate) {
    // Accumulates across days exactly as recordAnswer does, so retrievalDays
    // really does record one distinct day per session.
    const st = { seen: 0, correct: 0, wrong: 0, fastWrong: 0, slowRight: 0, lastSeen: 0 };
    for (let d = 0; d < days; d++) {
      const t = Date.UTC(2026, 0, 1) + d * DAY;
      if (mutate) mutate(st, d, t);
      else { st.seen++; st.correct++; st.lastSeen = t; Core.noteRetrieval(st, true, t); }
    }
    return { solo: st };
  }

  it("the ceiling reflects what the bank can actually offer", () => {
    const narrow = Mastery.transferCeiling([one]);
    expect(narrow.offered).toBe(1);
    expect(narrow.offeredForms).toBe(1);
    expect(narrow.canShowTransfer).toBe(false);

    const wide = Mastery.transferCeiling([
      { ...one, id: "a", form: "recall" },
      { ...one, id: "b", form: "scenario" },
    ]);
    expect(wide.canShowTransfer).toBe(true);
  });

  it("repeating one correct answer across separate days can reach strong", () => {
    // The defect this pins: a concept shipped as ONE question could never show
    // the 2 variants / 2 forms the gate asked for, so it was pinned at
    // "learning" forever. In the GB bank that was 351 of 359 concepts.
    const r = Mastery.conceptState([one], soloStats(5), null, Date.UTC(2026, 0, 8));
    expect(r.state).toBe("strong");
  });

  it("a single day is still NOT enough, however many attempts", () => {
    const r = Mastery.conceptState([one], soloStats(1), null, Date.UTC(2026, 0, 8));
    expect(r.state).toBe("learning");
  });

  it("narrow concepts stay strict: slow answers cap at secure", () => {
    const r = Mastery.conceptState([one], soloStats(5, (st, d, t) => {
      st.seen++; st.correct++; st.lastSeen = t; st.slowRight = 4; Core.noteRetrieval(st, true, t);
    }), null, Date.UTC(2026, 0, 8));
    expect(r.state).toBe("secure");
  });

  it("narrow concepts stay strict: errors keep them out of secure", () => {
    const r = Mastery.conceptState([one], soloStats(5, (st, d, t) => {
      if (d === 0) { st.seen++; st.wrong++; st.lastSeen = t; st.lastWrong = t; }
      else { st.seen++; st.correct++; st.lastSeen = t; Core.noteRetrieval(st, true, t); }
    }), null, Date.UTC(2026, 0, 8));
    expect(r.state).toBe("learning");
  });

  it("transfer is still required when the bank offers it", () => {
    const wide = [
      { ...one, id: "a", form: "recall" },
      { ...one, id: "b", form: "scenario" },
      { ...one, id: "c", form: "diagram" },
    ];
    const stats = { a: { seen: 6, correct: 6, wrong: 0, lastSeen: Date.UTC(2026, 0, 5) } };
    const r = Mastery.conceptState(wide, stats, null, Date.UTC(2026, 0, 8));
    expect(r.state).not.toBe("strong");
  });

  it("a perfect learner is no longer told they are still Learning on most of the GB bank", () => {
    // End-to-end proof against the real bank: the original symptom.
    const stats = {};
    for (let d = 0; d < 5; d++) {
      for (const q of GB_QUESTIONS) {
        const t = Date.UTC(2026, 0, 1) + d * DAY;
        const st = stats[q.id] || { seen: 0, correct: 0, wrong: 0, fastWrong: 0, slowRight: 0, lastSeen: 0 };
        st.seen++; st.correct++; st.lastSeen = t;
        Core.noteRetrieval(st, true, t);
        stats[q.id] = st;
      }
    }
    const now = Date.UTC(2026, 0, 8);
    const rows = Mastery.conceptMap(GB_QUESTIONS, stats, {}, now);
    const learning = rows.filter((r) => r.state === "learning").length;
    expect(learning / rows.length).toBeLessThan(0.05);
  });
});

/* ---------------- retrieval-day recording ---------------- */
describe("retrieval days are recorded per question", () => {
  it("records each distinct day once and ignores wrong answers", () => {
    const st = { seen: 0, correct: 0, wrong: 0 };
    Core.noteRetrieval(st, true, Date.UTC(2026, 0, 1, 9));
    Core.noteRetrieval(st, true, Date.UTC(2026, 0, 1, 18)); // same day
    Core.noteRetrieval(st, true, Date.UTC(2026, 0, 2, 9));
    Core.noteRetrieval(st, false, Date.UTC(2026, 0, 3, 9)); // wrong -> no day
    expect(st.retrievalDays).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("survives a sanitize round-trip and rejects junk", () => {
    const s = Core.sanitizeState({ qstats: { a: { seen: 2, correct: 2, retrievalDays: ["2026-01-01", 7, null, "nope"] } } });
    expect(s.qstats.a.retrievalDays).toEqual(["2026-01-01"]);
    const legacy = Core.sanitizeState({ qstats: { b: { seen: 1, correct: 1 } } });
    expect(legacy.qstats.b.retrievalDays).toBeUndefined();
  });

  it("keeps the history bounded so the save file cannot grow without limit", () => {
    const st = { seen: 0, correct: 0, wrong: 0 };
    for (let i = 0; i < Core.MAX_RETRIEVAL_DAYS + 20; i++) {
      Core.noteRetrieval(st, true, Date.UTC(2026, 0, 1) + i * DAY);
    }
    expect(st.retrievalDays.length).toBe(Core.MAX_RETRIEVAL_DAYS);
  });
});

/* ------------------------------------------------------------------ *
 * 4. Hazard perception must be able to enter the plan (GB)           *
 * ------------------------------------------------------------------ */
describe("hazard perception enters the plan where the exam scores it", () => {
  const catOf = (name) => (Scenarios.scenarios.find((s) => s.name === name) || {}).category || null;
  const labelOf = (cat) => Scenarios.categoryLabel(cat);

  function baseInput(extra) {
    return Object.assign({
      bank: GB_QUESTIONS,
      qstats: {},
      exams: [],
      daily: {},
      misconceptions: {},
      categories: {},
      testDate: "",
      today: "2026-01-07",
      nowMs: Date.UTC(2026, 0, 7),
      hazardCategoryOf: catOf,
      hazardCategoryLabel: labelOf,
      terminology: { examName: "theory test" },
    }, extra || {});
  }

  it("is recommended for a GB learner who has never tried it", () => {
    const plan = Coach.recommend(baseInput({ hazardPerception: GB_HP }));
    const rec = plan.all.find((c) => c.type === Coach.REC_TYPES.HAZARD_TRAINING);
    expect(rec).toBeTruthy();
    expect(rec.why.join(" ")).toMatch(/scored section/i);
  });

  it("is recommended for a GB learner with a weak hazard category, naming it", () => {
    const cyclist = Scenarios.scenarios.find((s) => s.category === "cyclists");
    const other = Scenarios.scenarios.find((s) => s.category === "children");
    const log = [];
    for (let i = 0; i < 6; i++) log.push({ scenario: cyclist.name, band: "late", pts: 1 });
    for (let i = 0; i < 6; i++) log.push({ scenario: other.name, band: "instant", pts: 5 });
    const plan = Coach.recommend(baseInput({ hazardPerception: GB_HP, hazardLog: log }));
    const rec = plan.all.find((c) => c.type === Coach.REC_TYPES.HAZARD_TRAINING);
    expect(rec).toBeTruthy();
    expect(rec.hazardCategories).toContain("cyclists");
    expect(rec.why.join(" ")).toMatch(/weakest hazard type/i);
  });

  it("is NEVER recommended where the exam does not score hazard perception", () => {
    // Most US states run no hazard-perception test; listing it as a study
    // priority there would be inventing an exam requirement.
    const log = [{ scenario: Scenarios.scenarios[0].name, band: "late", pts: 1 }];
    const plan = Coach.recommend(baseInput({ hazardPerception: US_HP, hazardLog: log }));
    expect(plan.all.some((c) => c.type === Coach.REC_TYPES.HAZARD_TRAINING)).toBe(false);
  });

  it("makes no weak-category claim from a sample too small to support one", () => {
    const sc = Scenarios.scenarios.find((s) => s.category === "cyclists");
    const plan = Coach.recommend(baseInput({
      hazardPerception: GB_HP,
      hazardLog: [{ scenario: sc.name, band: "late", pts: 1 }],
    }));
    const rec = plan.all.find((c) => c.type === Coach.REC_TYPES.HAZARD_TRAINING);
    expect(rec).toBeTruthy();
    expect(rec.hazardCategories).toEqual([]);
    expect(rec.evidence).toEqual([]);
  });

  it("maps to its own intervention so its effect can be measured", () => {
    expect(Core.interventionFor("hazard-training")).toBe("hazard-training");
    expect(Core.INTERVENTIONS).toContain("hazard-training");
  });

  it("ranks behind misconceptions but ahead of new coverage", () => {
    const plan = Coach.recommend(baseInput({ hazardPerception: GB_HP }));
    const hz = plan.all.find((c) => c.type === Coach.REC_TYPES.HAZARD_TRAINING);
    expect(hz.rank).toBeGreaterThan(10); // below fix-misconception
    expect(hz.rank).toBeLessThan(40);     // above strengthen-weak-topic
  });
});

/* ------------------------------------------------------------------ *
 * 5. Readiness must state its own scope                                *
 * ------------------------------------------------------------------ */
describe("readiness discloses the sections it does not cover", () => {
  it("GB declares an unscored-section note; US does not", () => {
    expect(GB_HP.unscoredSectionNote).toBeTruthy();
    expect(GB_HP.unscoredSectionNote).toMatch(/hazard/i);
    expect(US_HP.unscoredSectionNote).toBeUndefined();
  });

  it("the note reaches the readiness panel only for scored jurisdictions", () => {
    const src = readFileSync(fileURLToPath(new URL("../js/home-ui.js", import.meta.url)), "utf8");
    expect(src).toMatch(/rpScopeNote/);
    expect(src).toMatch(/unscoredSectionNote/);
  });

  it("the progress figure still never claims to be a pass prediction", () => {
    const src = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
    expect(src).toMatch(/not a pass prediction/i);
  });
});