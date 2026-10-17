/* Question issue reports (errata outbox): filing, validation, listing,
   sanitization, and export/import round-trip. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-10-16T09:00:00Z");

describe("fileIssueReport", () => {
  it("files a report with kind, trimmed note, and timestamp", () => {
    const reports = {};
    const r = Core.fileIssueReport(reports, "sg01", "wrong-answer", "  The octagon question is fine actually  ", NOW);
    expect(r).toEqual({ ok: true });
    expect(reports.sg01).toEqual({ kind: "wrong-answer", note: "The octagon question is fine actually", at: NOW });
  });

  it("rejects unknown kinds and bad question ids", () => {
    const reports = {};
    expect(Core.fileIssueReport(reports, "sg01", "bogus", "", NOW).ok).toBe(false);
    expect(Core.fileIssueReport(reports, "", "typo", "", NOW).ok).toBe(false);
    expect(Core.fileIssueReport(reports, "x".repeat(65), "typo", "", NOW).ok).toBe(false);
    expect(Core.fileIssueReport(null, "sg01", "typo", "", NOW).ok).toBe(false);
    expect(reports).toEqual({});
  });

  it("caps notes at 500 characters and re-filing overwrites", () => {
    const reports = {};
    Core.fileIssueReport(reports, "sg01", "typo", "y".repeat(600), NOW);
    expect(reports.sg01.note).toHaveLength(Core.MAX_ISSUE_NOTE);
    Core.fileIssueReport(reports, "sg01", "other", "changed my mind", NOW + 1);
    expect(reports.sg01).toEqual({ kind: "other", note: "changed my mind", at: NOW + 1 });
  });

  it("bounds the map at 200, dropping the oldest", () => {
    const reports = {};
    for (let i = 0; i < 205; i++) {
      Core.fileIssueReport(reports, `q${i}`, "typo", "", NOW + i);
    }
    expect(Object.keys(reports)).toHaveLength(Core.MAX_ISSUE_REPORTS);
    expect(reports.q0).toBeUndefined();
    expect(reports.q204).toBeDefined();
  });
});

describe("withdrawIssueReport", () => {
  it("removes an existing report and reports absence", () => {
    const reports = { sg01: { kind: "typo", note: "", at: NOW } };
    expect(Core.withdrawIssueReport(reports, "sg01")).toBe(true);
    expect(reports).toEqual({});
    expect(Core.withdrawIssueReport(reports, "sg01")).toBe(false);
    expect(Core.withdrawIssueReport(null, "sg01")).toBe(false);
  });
});

describe("listedIssueReports", () => {
  const bank = [{ id: "sg01", q: "What must you do at this sign?", choices: ["a", "b"], a: 0 }];

  it("orders newest first and marks ids missing from the bank as stale", () => {
    const byId = { sg01: bank[0] };
    const reports = {
      sg01: { kind: "typo", note: "", at: NOW },
      gone99: { kind: "wrong-answer", note: "removed?", at: NOW + 1000 },
    };
    const list = Core.listedIssueReports(reports, byId);
    expect(list.map((r) => r.qid)).toEqual(["gone99", "sg01"]);
    expect(list[0].stale).toBe(true);
    expect(list[1].stale).toBe(false);
    expect(list[1].question.q).toContain("What must you do");
  });

  it("skips entries with unknown kinds", () => {
    const list = Core.listedIssueReports({ sg01: { kind: "bogus", note: "", at: NOW } }, {});
    expect(list).toEqual([]);
  });
});

describe("persistence", () => {
  it("default state carries an empty report map", () => {
    expect(Core.defaultState().issueReports).toEqual({});
  });

  it("sanitization drops malformed entries and caps the map", () => {
    const reports = { sg01: { kind: "typo", note: "ok", at: NOW } };
    for (let i = 0; i < 205; i++) reports[`q${i}`] = { kind: "typo", note: "", at: NOW + i };
    const m = Core.migrateState({
      v: 2,
      issueReports: {
        ...reports,
        bad1: { kind: "bogus", note: "", at: NOW },
        bad2: { kind: "typo", note: "", at: 0 },
        bad3: "not-an-object",
      },
    }, {});
    expect(m.state.issueReports.sg01).toBeUndefined(); // oldest, pushed out by the cap
    expect(m.state.issueReports.q204).toBeDefined();
    expect(m.state.issueReports.bad1).toBeUndefined();
    expect(m.state.issueReports.bad2).toBeUndefined();
    expect(m.state.issueReports.bad3).toBeUndefined();
    expect(Object.keys(m.state.issueReports)).toHaveLength(Core.MAX_ISSUE_REPORTS);
  });

  it("reports ride along in the export bundle and back", () => {
    const s = Core.defaultState();
    Core.fileIssueReport(s.issueReports, "sg01", "unclear-wording", "confusing", NOW);
    const back = Core.parseImport(Core.exportBundle(s));
    expect(back.ok).toBe(true);
    expect(back.state.issueReports.sg01).toEqual({ kind: "unclear-wording", note: "confusing", at: NOW });
  });
});
