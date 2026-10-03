/* Road Ready — Concept Mastery Map UI.
 *
 * A visual learning map for one topic: every concept with its honest state
 * (Unseen / Seen once / Learning / Secure / Strong, overlaid by Needs review
 * or Recurring misconception), expandable detail (attempts, accuracy, recent
 * answers, fluency, question styles seen, last reviewed, misconception
 * history) and one recommended next action. Deliberately simple — a learner
 * should read it in seconds, not study it.
 *
 * Logic lives in js/mastery.js (concept states) and js/coach.js (actions);
 * this file renders and wires only.
 *
 * Classic-script module: dependencies arrive via RoadReadyConceptMapUI.init(ctx).
 */
"use strict";

(function () {
  let ctx = null;
  let currentTopicId = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); }

  const FORM_LABELS = {
    recall: "direct recall",
    scenario: "scenario",
    diagram: "road-layout diagram",
    "sign-combo": "sign combination",
    "lane-choice": "lane choice",
    "what-next": "what happens next",
    photo: "photo-described scene",
    "multi-step": "multi-step ordering",
    prioritisation: "prioritisation",
  };

  function stateChip(state) {
    const span = document.createElement("span");
    span.className = `cm-chip cm-${state}`;
    span.textContent = (ctx.Mastery.MASTERY_DISPLAY[state] || state);
    return span;
  }

  function render(topicId) {
    const { Core, Mastery, CATEGORIES, getState, getBank, icon, startPractice, shuffle, showView } = ctx;
    const state = getState();
    const bank = getBank();
    const cat = CATEGORIES[topicId];
    if (!cat) return;
    currentTopicId = topicId;

    const topicQs = bank.filter((q) => q.cat === topicId);
    const rows = Mastery.conceptMap(topicQs, state.qstats, state.misconceptions, Date.now());
    const summary = Mastery.masterySummary(rows);

    $("cmTitle").textContent = cat.name;
    $("cmSub").textContent = `How solid each concept in ${cat.name.toLowerCase()} really is — not just whether you have seen it.`;

    // Plain statements first — no vanity percentages.
    const statements = $("cmStatements");
    statements.replaceChildren(...summary.statements.map((line) => {
      const p = document.createElement("p");
      p.className = "cm-statement";
      p.textContent = line;
      return p;
    }));

    const host = $("cmList");
    host.replaceChildren();
    rows.forEach((row) => {
      const card = document.createElement("div");
      card.className = "card cm-card";

      const head = document.createElement("div");
      head.className = "cm-head";
      const label = document.createElement("b");
      label.className = "cm-label";
      label.textContent = row.label;
      head.append(label, stateChip(row.state));

      const sub = document.createElement("p");
      sub.className = "cm-sub";
      const ev = row.evidence;
      const parts = [];
      if (ev.attempts) {
        parts.push(`${ev.attempts} answer${ev.attempts === 1 ? "" : "s"} · ${Math.round(ev.accuracy * 100)}% correct`);
      } else {
        parts.push(`${row.questionCount} question${row.questionCount === 1 ? "" : "s"} available`);
      }
      if (ev.variants) parts.push(`${ev.variants} variation${ev.variants === 1 ? "" : "s"} tried`);
      sub.textContent = parts.join(" · ");

      // Progressive disclosure: detail only when opened.
      const details = document.createElement("details");
      details.className = "cm-details";
      const summaryEl = document.createElement("summary");
      summaryEl.textContent = "Details";
      details.appendChild(summaryEl);

      const ul = document.createElement("ul");
      ul.className = "cm-facts";
      const addFact = (text) => {
        const li = document.createElement("li");
        li.textContent = text;
        ul.appendChild(li);
      };
      addFact(`${ev.correct} correct of ${ev.attempts} answered (${row.questionCount} question${row.questionCount === 1 ? "" : "s"} in this concept).`);
      // Recent answers: derived honestly from the stored history, never invented.
      if (ev.lastSeen) {
        const recent = ev.lastWrong && ev.lastWrong >= ev.lastSeen ? "your most recent answer was wrong" : "your most recent answer was correct";
        addFact(`Last reviewed ${new Date(ev.lastSeen).toLocaleDateString()} — ${recent}.`);
      }
      if (ev.attempts >= 3) {
        addFact(ev.slowRight
          ? `Answered correctly but slowly ${ev.slowRight} time${ev.slowRight === 1 ? "" : "s"} — not automatic yet.`
          : "Answers are landing quickly — recall is becoming automatic.");
      }
      if (ev.forms) {
        const formNames = [...new Set((row.evidence.questionIds || []).map((id) => {
          const q = bank.find((x) => x.id === id);
          return q ? FORM_LABELS[q.form || "recall"] : null;
        }).filter(Boolean))];
        addFact(`Question styles tried: ${formNames.join(", ") || "direct recall"}.`);
      }
      const mis = row.misconception;
      if (mis) {
        addFact(`Misconception history: ${mis.errors} wrong answer${mis.errors === 1 ? "" : "s"} on this rule${mis.stage >= 2 ? " — repeating" : ""}${mis.repairedAt ? ", repaired" : ""}.`);
      } else if (row.evidence.wrong > 0) {
        addFact(`Mistake history: ${row.evidence.wrong} wrong answer${row.evidence.wrong === 1 ? "" : "s"} so far.`);
      }
      addFact(`Recommended next: ${row.nextAction.label}.`);
      details.appendChild(ul);

      const action = document.createElement("button");
      action.type = "button";
      action.className = "btn ghost cm-action";
      action.innerHTML = `${icon("target", 14)} Practise this concept`;
      on(action, "click", (e) => {
        e.stopPropagation();
        const qs = Core.groupByConcept(topicQs).get(row.key) || [];
        if (qs.length) startPractice(shuffle(qs), row.label, "conceptmap");
      });
      details.appendChild(action);

      card.append(head, sub, details);
      host.appendChild(card);
    });

    // Primary action: drill the weakest concepts first. Buttons are cloned
    // before wiring so repeated renders never stack stale listeners.
    const drillBtn = $("btnCmDrill").cloneNode(true);
    $("btnCmDrill").replaceWith(drillBtn);
    const backBtn = $("btnCmBack").cloneNode(true);
    $("btnCmBack").replaceWith(backBtn);
    const weakRows = rows.filter((r) => r.state !== "strong" && r.state !== "secure").slice(0, 3);
    drillBtn.textContent = weakRows.length
      ? `Practise the weakest (${weakRows.length} concept${weakRows.length === 1 ? "" : "s"})`
      : "Mixed refresher";
    on(drillBtn, "click", () => {
      const keys = (weakRows.length ? weakRows : rows.slice(0, 3)).map((r) => r.key);
      const qs = topicQs.filter((q) => keys.includes(Core.conceptKeyOf(q)));
      if (qs.length) startPractice(shuffle(qs).slice(0, 10), `${cat.name} — weakest concepts`, "conceptmap");
    });

    on(backBtn, "click", () => showView("stats"));
  }

  window.RoadReadyConceptMapUI = {
    /**
     * @param {{Core, Mastery, CATEGORIES, getState, getBank, icon,
     *          startPractice, shuffle, showView}} deps
     */
    init(deps) { ctx = deps; },
    render,
    get topicId() { return currentTopicId; },
  };
})();