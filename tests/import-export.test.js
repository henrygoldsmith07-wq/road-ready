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
  it("generic bank excludes state-tagged questions; packs include theirs", () => {
    const bank = [
      { id: "u1", cat: "signs", states: undefined },
      { id: "ca1", cat: "laws", states: ["CA"] },
      { id: "ny1", cat: "laws", states: ["NY", "PA"] },
    ];
    expect(Packs.filterBankForPack(bank, "generic").map((q) => q.id)).toEqual(["u1"]);
    expect(Packs.filterBankForPack(bank, "CA").map((q) => q.id)).toEqual(["u1", "ca1"]);
    expect(Packs.filterBankForPack(bank, "NY").map((q) => q.id)).toEqual(["u1", "ny1"]);
    expect(Packs.filterBankForPack(bank, "PA").map((q) => q.id)).toEqual(["u1", "ny1"]);
  });

  it("every pack declares its key facts", () => {
    for (const p of Object.values(Packs.STATE_PACKS)) {
      expect(p.facts.bacAdult).toBeTruthy();
      expect(p.facts.bacUnder21).toBeTruthy();
      expect(p.facts.rightOnRed).toBeTruthy();
      expect(p.name).toBeTruthy();
    }
  });
});
