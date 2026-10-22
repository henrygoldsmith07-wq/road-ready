/* Road Ready — content provenance reporting.
 *
 * Pure and DOM-free so the ledger can be unit-tested: it takes the loaded
 * bank and the source registry and returns what the Content & Sources view
 * renders. No network, no storage, no side effects.
 *
 * The point is to make a claim checkable. "Every question traces to a named
 * official document" is only worth making if the user can see the documents
 * and the dates — so this module produces exactly that, with no page able to
 * show a source that backs no question and no question that hides its source. */
"use strict";

(function () {
  /* How many rule sections to name per source before it stops being useful
   * on a card. */
  const MAX_SECTIONS = 3;

  function buildReport(ctx) {
    const bank = (ctx && ctx.bank) || [];
    const registry = (ctx && ctx.registry) || {};
    const packLabel = (ctx && ctx.packLabel) || "this pack";
    const reportUrl = (ctx && ctx.reportUrl) || "";
    const maxAgeDays = (ctx && ctx.maxAgeDays) || 365;

    /* Which sources actually back a question in the ACTIVE bank. A source
     * with no question behind it is not part of this pack's story, and
     * showing it would be padding. */
    const bySource = new Map();
    for (const q of bank) {
      const id = q && q.sourceId;
      if (!id) continue;
      if (!bySource.has(id)) bySource.set(id, { count: 0, sections: new Map() });
      const entry = bySource.get(id);
      entry.count += 1;
      const section = q.sourceSection;
      if (section) entry.sections.set(section, (entry.sections.get(section) || 0) + 1);
    }

    const sources = [];
    for (const [id, usage] of bySource) {
      const source = registry[id];
      if (!source) continue;
      const isBasis = source.citationLabel === "Reference basis";
      sources.push({
        id,
        title: source.title,
        agency: source.agency,
        url: source.url || null,
        verified: source.verified || null,
        jurisdiction: source.jurisdiction || null,
        jurisdictionLabel: source.jurisdiction && source.jurisdiction !== "*"
          ? source.jurisdiction : null,
        label: source.citationLabel || "Official source",
        isBasis,
        count: usage.count,
        /* How the section list should be described. A U.S. state pack names
         * the app's own topic label, which is NOT a heading in the handbook;
         * the UK sources name the actual rule. Labelling both "Covers"
         * would overstate the U.S. side and undersell the UK side. */
        sectionKind: source.sectionKind || "topic",
        sectionLabel: source.sectionKind === "rule" ? "Rules covered" : "Topics covered",
        topSections: [...usage.sections.entries()]
          /* Most-covered first: the topics a card lists should be
           * representative of the source, not just the first one met. */
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, MAX_SECTIONS)
          .map(([name]) => name),
        basisNote: isBasis ? (source.basisNote || null) : null,
      });
    }

    /* Official documents first, then the composite; within a group, the most
     * recently checked first — a fresher handbook is the more useful answer
     * to "is this current?". */
    sources.sort((a, b) => {
      if (a.isBasis !== b.isBasis) return a.isBasis ? 1 : -1;
      const av = a.verified || "", bv = b.verified || "";
      if (av !== bv) return av < bv ? 1 : -1;
      return a.title.localeCompare(b.title);
    });

    const dates = sources.map((s) => s.verified).filter(Boolean).sort();
    const oldest = dates.length ? dates[0] : null;
    const newest = dates.length ? dates[dates.length - 1] : null;
    const officialCount = sources.filter((s) => !s.isBasis).length;
    const basisCount = sources.length - officialCount;

    const stats = [
      { value: String(bank.length), label: "questions" },
      { value: String(sources.length), label: "source" + (sources.length === 1 ? "" : "s") },
    ];
    /* Only claim what is actually there. A pack with no state selected rests
     * entirely on the composite, so an "official documents" figure of zero is
     * the truth and has to be stated as such rather than quietly dropped. */
    if (officialCount > 0) {
      stats.push({ value: String(officialCount), label: "official document" + (officialCount === 1 ? "" : "s") });
    }
    if (basisCount > 0) {
      stats.push({ value: String(basisCount), label: "reference basis" + (basisCount === 1 ? "" : "es") });
    }
    stats.push({ value: oldest ? formatShort(oldest) : "—", label: "oldest check" });

    const lead = officialCount > 0
      ? bank.length + " questions, each traced to a named official document"
        + (basisCount > 0 ? " or a stated reference basis" : "")
        + ". Every source was last checked on the date shown."
      : bank.length + " questions, each traced to a named reference basis"
        + ". Choose your state pack and these same questions will cite that state's own official handbook instead.";

    /* How stale is the oldest source against the project's own verification
     * window? Saying so is more useful than hiding it. Content QA fails the
     * build when a source passes the window, so this is a backstop for a
     * deployment that has been running for a while. */
    const stale = oldest && maxAgeDays ? daysSince(oldest) > maxAgeDays : false;

    /* The footer must describe THIS pack, not the app in general. A Great
     * Britain ledger that talks about the U.S. composite is confusing; a
     * U.S. one that does not mention it is hiding a real distinction. */
    const footerParts = ["Sources are verified against a maximum age of " + maxAgeDays
      + " days; the build fails if one goes stale."];
    if (basisCount > 0) {
      footerParts.push("The universal U.S. bank is a composite of many state handbooks, so it is labelled a "
        + "reference basis rather than an official source — your state pack's questions each cite that state's own handbook.");
    } else {
      footerParts.push("Every question in this pack cites a document published by the authority that sets the rule.");
    }

    return {
      questionCount: bank.length,
      packLabel,
      lead,
      sources,
      stats,
      oldest,
      newest,
      stale,
      reportUrl,
      correctionSteps: [
        "Check the answer against the current handbook for your jurisdiction — the link on each card opens the official document.",
        "Tell us what is wrong and which rule it should cite. Every question here is checked against a named source, so a correction is specific.",
        "Corrections are applied to the bank and the source's checked-on date is updated, so the ledger stays true.",
      ],
      footer: footerParts.join(" "),
    };
  }

  function formatShort(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  }

  function daysSince(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 0;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  window.RoadReadySources = { buildReport };
  if (typeof module !== "undefined" && module.exports) module.exports = window.RoadReadySources;
})();
