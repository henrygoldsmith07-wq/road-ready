/* REGRESSION: state-pack selection must survive save/reload (the original
   sanitizeState bug reset every non-generic pack to "generic"). */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import Packs from "../js/state-packs.js";

const IDS = Packs.PACK_IDS;
const round = (s, opts) => Core.migrateState(JSON.parse(JSON.stringify(s)), opts).state;

describe("state-pack persistence", () => {
  it("preserves California after save/reload (exact user test, no opts)", () => {
    const s = Core.defaultState();
    s.settings.statePack = "CA";
    expect(Core.migrateState(JSON.stringify(s)).state.settings.statePack).toBe("CA");
  });

  it("preserves every shipped region through the full save/load cycle", () => {
    for (const id of IDS.filter((x) => x !== "generic")) {
      const s = Core.defaultState();
      s.settings.statePack = id;
      const reloaded = round(s, { packIds: IDS });
      expect(reloaded.settings.statePack).toBe(id);
      // and via JSON string path exactly as localStorage does it
      const s2 = JSON.parse(JSON.stringify(reloaded));
      expect(Core.migrateState(JSON.stringify(s2), { packIds: IDS }).state.settings.statePack).toBe(id);
    }
  });

  it("survives legacy v1 payloads that already carried a pack", () => {
    const legacy = { answered: 3, settings: { theme: "dark", statePack: "NY" } };
    expect(Core.migrateState(legacy, { packIds: IDS }).state.settings.statePack).toBe("NY");
  });

  it("survives export → import", () => {
    const s = Core.defaultState();
    s.settings.statePack = "TX";
    const r = Core.parseImport(Core.exportBundle(s), { packIds: IDS });
    expect(r.ok).toBe(true);
    expect(r.state.settings.statePack).toBe("TX");
  });

  it("garbage still normalizes to generic; non-string junk never persists", () => {
    for (const bad of [42, null, "", "   ", {}, ["CA"]]) {
      const s = Core.defaultState();
      s.settings.statePack = bad;
      expect(round(s, { packIds: IDS }).settings.statePack).toBe("generic");
    }
  });
});
