/* Import / export round-trip & validation */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import Packs from "../js/state-packs.js";

describe("export", () => {
  it("produces a versioned envelope with the state inside", () => {
    const s = Core.defaultState();
    s.answered = 12;
    s.xp = 120;
    const bundle = JSON.parse(Core.exportBundle(s));
    expect(bundle.app).toBe("road-ready");
    expect(bundle.schema).toBe(Core.SCHEMA_VERSION);
    expect(typeof bundle.exportedAt).toBe("string");
    expect(bundle.state.answered).toBe(12);
    expect(bundle.state.xp).toBe(120);
  });

  it("export is detached (mutating after export does not change the file)", () => {
    const s = Core.defaultState();
    const text = Core.exportBundle(s);
    s.answered = 999;
    expect(JSON.parse(text).state.answered).not.toBe(999);
  });
});

describe("import", () => {
  it("round-trips an export exactly", () => {
    const s = Core.defaultState();
    s.qstats.sg01 = { seen: 3, correct: 3, wrong: 0 };
    s.exams.push({ date: 1700000000000, label: "Full Test", pct: 0.9, correct: 41, total: 46, pass: true });
    s.streak = { count: 5, last: "2026-08-21" };
    const parsed = Core.parseImport(Core.exportBundle(s));
    expect(parsed.ok).toBe(true);
    expect(parsed.state.qstats.sg01.seen).toBe(3);
    expect(parsed.state.exams[0].pass).toBe(true);
    expect(parsed.state.streak.count).toBe(5);
    expect(parsed.warnings || []).toEqual([]);
  });

  it("imports legacy exports by running migrations", () => {
    // an export produced before state packs / daily history existed
    const legacyExport = {
      app: "road-ready",
      schema: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      state: { answered: 7, correctCount: 6, xp: 62, settings: { theme: "light" } },
    };
    const r = Core.parseImport(JSON.stringify(legacyExport));
    expect(r.ok).toBe(true);
    expect(r.state.v).toBe(Core.SCHEMA_VERSION);
    expect(r.state.answered).toBe(7);
    expect(r.state.settings.theme).toBe("light");
    expect(r.state.settings.statePack).toBe("generic");
  });

  it("rejects foreign apps, junk and truncation", () => {
    for (const [text, error] of [
      ["", "empty"],
      ["   ", "empty"],
      ["{broken", "not-json"],
      ["42", "not-object"],
      ['{"app":"other-app","schema":2,"state":{}}', "wrong-app"],
      ['{"app":"road-ready","state":{}}', "missing-schema"],
      ['{"app":"road-ready","schema":2}', "missing-state"],
      ['{"app":"road-ready","schema":2,"state":[]}', "missing-state"],
    ]) {
      const r = Core.parseImport(text);
      expect(r.ok).toBe(false);
      expect(r.error).toBe(error);
    }
  });
});

describe("state packs", () => {
  it("generic bank excludes jurisdiction-tagged questions; packs include theirs", () => {
    const bank = [
      { id: "u1", cat: "signs", jurisdiction: undefined },
      { id: "ca-001", cat: "laws", jurisdiction: ["CA"] },
      { id: "ny-001", cat: "laws", jurisdiction: ["NY", "PA"] },
    ];
    expect(Packs.filterBankForPack(bank, "generic").map((q) => q.id)).toEqual(["u1"]);
    expect(Packs.filterBankForPack(bank, "CA").map((q) => q.id)).toEqual(["u1", "ca-001"]);
    expect(Packs.filterBankForPack(bank, "NY").map((q) => q.id)).toEqual(["u1", "ny-001"]);
    expect(Packs.filterBankForPack(bank, "PA").map((q) => q.id)).toEqual(["u1", "ny-001"]);
  });

  it("every pack declares its key facts", () => {
    for (const p of Object.values(Packs.STATE_PACKS)) {
      expect(p.facts.bacAdult).toBeTruthy();
      expect(p.facts.bacUnder21).toBeTruthy();
      expect(p.facts.rightOnRed).toBeTruthy();
      expect(p.name).toBeTruthy();
    }
  });

  it("jurisdiction packs ship real tagged questions with provenance", () => {
    const tagged = Packs.allPackQuestions().filter((q) => q.jurisdiction && q.jurisdiction.length);
    expect(tagged.length).toBeGreaterThanOrEqual(30); // ~6 per non-generic pack
    for (const q of tagged) {
      expect(typeof q.concept).toBe("string");
      expect(q.concept).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(typeof q.sourceId).toBe("string");
      expect(q.sourceId.length).toBeGreaterThan(0);
      expect(typeof q.sourceSection).toBe("string");
      // every tag must name a real pack
      q.jurisdiction.forEach((j) => expect(Packs.STATE_PACKS[j]).toBeTruthy());
      // sanity: well-formed MCQ
      expect(Array.isArray(q.choices)).toBe(true);
      expect(q.a).toBeLessThan(q.choices.length);
    }
  });

  it("selecting a pack actually grows the bank (state questions merge in)", () => {
    const fullBank = Packs.allPackQuestions().concat([{ id: "u1", cat: "signs" }]);
    const generic = Packs.filterBankForPack(fullBank, "generic");
    const ca = Packs.filterBankForPack(fullBank, "CA");
    expect(ca.length).toBeGreaterThan(generic.length);
  });

  it("resolves every state question and pack to its official handbook", () => {
    for (const pack of Object.values(Packs.STATE_PACKS).filter((p) => p.id !== "generic")) {
      const packSource = Packs.packSource(pack.id);
      expect(packSource.jurisdiction).toBe(pack.id);
      expect(packSource.url).toMatch(/^https:\/\//);
      for (const q of pack.questions) {
        expect(Packs.sourceForQuestion(q)).toBe(packSource);
      }
    }
    expect(Packs.packSource("generic")).toBe(null);
    expect(Packs.sourceForQuestion({ id: "u1" })).toBe(null);
  });
});

describe("migration honors real pack ids", () => {
  it("a saved CA selection survives reload when pack ids are supplied", () => {
    const saved = Core.defaultState();
    saved.settings.statePack = "CA";
    const m = Core.migrateState(JSON.parse(JSON.stringify(saved)), { packIds: Packs.PACK_IDS });
    expect(m.state.settings.statePack).toBe("CA");
  });

  it("unknown pack ids still clamp to generic", () => {
    const saved = Core.defaultState();
    saved.settings.statePack = "XX";
    expect(Core.migrateState(JSON.parse(JSON.stringify(saved)), { packIds: Packs.PACK_IDS }).state.settings.statePack).toBe("generic");
    expect(Core.migrateState(JSON.parse(JSON.stringify(saved))).state.settings.statePack).toBe("generic");
  });
});
