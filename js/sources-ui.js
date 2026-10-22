/* Road Ready — Content & Sources.
 *
 * A trust surface, not a settings page. Every question in the app is checked
 * against a named document from the issuing authority; this view makes that
 * checkable in one place — which document, which agency, which rule, and
 * when it was last verified.
 *
 * Why it exists: the question learners actually ask is "is this app
 * accurate?" — asked in every driving-theory forum, and answered by nobody in
 * the category. Every app links somewhere; this one shows the ledger.
 *
 * It is also where the honest distinction is explained rather than buried:
 * a question sourced from a single official handbook is an "Official source",
 * while the universal U.S. bank is a composite of many state handbooks and is
 * labelled a "Reference basis" — because presenting a composite as if it were
 * one official document would be a lie told in a citation.
 *
 * DOM-free logic lives in js/sources.js; this module only renders. */
"use strict";

(function () {
  const $ = (id) => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    if (!iso) return "not recorded";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function render(data) {
    const host = $("sourcesBody");
    if (!host || !data) return;

    host.replaceChildren();

    /* A source older than the project's verification window should never
     * ship — content QA blocks it — but a deployment that has been running
     * for a long time can drift past it. Say so rather than presenting a
     * stale check as current. */
    if (data.stale) {
      const warn = el("div", "card sources-stale");
      warn.appendChild(el("h2", "section-title", "This pack needs re-checking"));
      const wp = el("p", "sources-lead");
      wp.textContent = "The oldest source here was last checked on " + formatDate(data.oldest)
        + ", which is outside the " + "verification window. Treat the answers as needing a second look against the current document.";
      warn.appendChild(wp);
      host.appendChild(warn);
    }

    /* --- the headline: this many questions, this many sources, checked on
     *     these dates. It is the answer to "is this accurate?" in one line. */
    const head = el("div", "card sources-summary");
    head.appendChild(el("h2", "section-title", "What this pack is checked against"));
    const p = el("p", "sources-lead");
    p.textContent = data.lead;
    head.appendChild(p);

    const stats = el("div", "sources-stats");
    for (const stat of data.stats) {
      const box = el("div", "sources-stat");
      box.appendChild(el("span", "sources-stat-value", stat.value));
      box.appendChild(el("span", "sources-stat-label", stat.label));
      stats.appendChild(box);
    }
    head.appendChild(stats);
    host.appendChild(head);

    /* --- one card per source --- */
    const list = el("div", "sources-list");
    for (const source of data.sources) {
      const card = el("article", "card source-card");

      const head2 = el("div", "source-card-head");
      const titleWrap = el("div", "source-card-titlewrap");
      titleWrap.appendChild(el("h3", "source-card-title", source.title));

      const meta = el("p", "source-card-meta");
      meta.appendChild(el("span", "source-agency", source.agency));
      if (source.jurisdictionLabel) {
        meta.appendChild(el("span", "source-jurisdiction", source.jurisdictionLabel));
      }
      titleWrap.appendChild(meta);
      head2.appendChild(titleWrap);

      const badge = el("span", "source-badge" + (source.isBasis ? " is-basis" : ""), source.label);
      badge.title = source.isBasis
        ? "A composite of several documents rather than one official source"
        : "A single named document from the issuing authority";
      head2.appendChild(badge);
      card.appendChild(head2);

      const facts = el("dl", "source-facts");
      const addFact = (dt, dd) => {
        facts.appendChild(el("dt", null, dt));
        facts.appendChild(el("dd", null, dd));
      };
      addFact("Last checked", formatDate(source.verified));
      addFact("Questions backed", source.count === 1 ? "1 question" : source.count + " questions");
      if (source.topSections.length) {
        addFact(source.sectionLabel || "Topics covered", source.topSections.join(" · "));
      }
      card.appendChild(facts);

      if (source.isBasis && source.basisNote) {
        const note = el("p", "source-note");
        note.textContent = source.basisNote;
        card.appendChild(note);
      }

      if (source.url) {
        const link = el("a", "source-open");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open the document ↗";
        link.setAttribute("aria-label", "Open " + source.title + " in a new tab");
        card.appendChild(link);
      } else {
        const note = el("p", "source-note");
        note.textContent = "This basis covers several documents, so there is no single page to link to. "
          + "Its rules are the ones commonly taught across the state handbooks, and each answer names the rule it rests on.";
        card.appendChild(note);
      }

      list.appendChild(card);
    }
    host.appendChild(list);

    /* --- corrections: say how, and say what happens next --- */
    const corr = el("div", "card sources-corrections");
    corr.appendChild(el("h2", "section-title", "Found a wrong or out-of-date answer?"));
    const cp = el("p", "sources-lead");
    cp.textContent = "A rule changes, and a handbook is rewritten. If an answer here no longer matches the "
      + "current handbook, that is a bug — not a matter of opinion.";
    corr.appendChild(cp);

    const steps = el("ol", "sources-steps");
    for (const step of data.correctionSteps) {
      steps.appendChild(el("li", null, step));
    }
    corr.appendChild(steps);

    if (data.reportUrl) {
      const link = el("a", "source-open", "Report a correction ↗");
      link.href = data.reportUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      corr.appendChild(link);
    }
    host.appendChild(corr);

    /* --- the honest footer --- */
    const foot = el("p", "sources-foot");
    foot.textContent = data.footer;
    host.appendChild(foot);
  }

  window.RoadReadySourcesUI = { render };
})();
