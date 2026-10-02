/* Road Ready — practical driving log UI.
 *
 * Extracted from app.js: everything about logging behind-the-wheel practice
 * sessions (the chip form, the per-skill ratings, the session history list).
 * Business rules (what a session is, how the next skill is chosen, how the
 * practical score is computed) stay in js/core.js — this file is rendering and
 * form wiring only.
 *
 * Classic-script module: an IIFE factory receives its dependencies explicitly
 * from app.js via RoadReadyPracticalUI.init(ctx) instead of reaching into
 * hidden shared globals.
 */
"use strict";

(function () {
  let ctx = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { el.addEventListener(ev, fn); }

  /** Renders a row of toggle chips; returns nothing, mutates `set` in place. */
  function chipRow(host, values, set) {
    host.textContent = "";
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = v.replace(/-/g, " ");
      b.setAttribute("aria-pressed", String(set.has(v)));
      on(b, "click", () => {
        if (set.has(v)) set.delete(v);
        else set.add(v);
        b.setAttribute("aria-pressed", String(set.has(v)));
      });
      host.appendChild(b);
    }
  }

  function buildForm() {
    const { Core, form } = ctx;
    chipRow($("plConditions"), Core.CONDITIONS, form.conditions);
    chipRow($("plRoadTypes"), Core.ROAD_TYPES, form.roadTypes);

    const sk = $("plSkills");
    sk.textContent = "";
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
          btn.setAttribute("aria-pressed", String(form.skills[skillId] === val));
          on(btn, "click", () => {
            if (form.skills[skillId] === val) delete form.skills[skillId];
            else form.skills[skillId] = val;
            seg.querySelectorAll("button").forEach((x) => {
              x.setAttribute("aria-pressed", String(
                form.skills[skillId] === x.getAttribute("aria-label").split(": ")[1],
              ));
            });
          });
          seg.appendChild(btn);
        }
        rowEl.appendChild(seg);
        block.appendChild(rowEl);
      }
      sk.appendChild(block);
    }
  }

  function localDateFromDay(dayIso) {
    if (!ctx.Core.validIsoDate(dayIso)) return null;
    return new Date(Number(dayIso.slice(0, 4)), Number(dayIso.slice(5, 7)) - 1, Number(dayIso.slice(8, 10)), 12).getTime();
  }

  function removeSession(index) {
    const { Core, getState, save, render } = ctx;
    const log = Core.practicalLog(getState());
    if (!Number.isInteger(index) || index < 0 || index >= log.length) return;
    log.splice(index, 1);
    save();
    render();
  }

  function saveSession() {
    const { Core, getState, form, save, render, toast } = ctx;
    const state = getState();
    const minutes = parseInt($("plMinutes").value, 10);
    const skills = Object.keys(form.skills);
    if (!skills.length) { window.alert("Rate at least one skill before saving."); return; }
    const dateVal = $("plDate").value ? (localDateFromDay($("plDate").value) ?? Date.now()) : Date.now();
    state.practical = { log: Core.practicalLog(state) };
    state.practical.log = Core.appendPracticalSession(state.practical.log, {
      date: isFinite(dateVal) ? dateVal : Date.now(),
      minutes: isFinite(minutes) ? minutes : 45,
      conditions: [...form.conditions],
      roadTypes: [...form.roadTypes],
      skills: { ...form.skills },
      notes: $("plNotes").value,
    });
    save();
    form.conditions.clear();
    form.roadTypes.clear();
    form.skills = {};
    buildForm();
    $("plNotes").value = "";
    render();
    toast("Session logged", "Next practice skill updated.", "car");
  }

  function render() {
    const { Core, getState, todayStr } = ctx;
    if (!$("view-practical")) return;
    const state = getState();
    const log = Core.practicalLog(state);
    // Keep theory and practical evidence separate in the UI. A single blended
    // percentage implies a level of real-world validation the product does not
    // have — theory numbers are training progress, not driving readiness.
    const theoryPct = Math.round(ctx.readiness() * 100);
    const practical = Core.practicalScore(log);
    $("drTheory").textContent = theoryPct + "%";
    $("drPractical").textContent = practical === null ? "no sessions yet" : Math.round(practical * 100) + "%";

    // One next practice skill — not seven competency charts. All text below
    // is inserted via textContent (no HTML string construction), so session
    // notes and labels can never become executable markup.
    const focus = Core.nextPracticeSkill
      ? Core.nextPracticeSkill(log)
      : Core.nextLessonFocus(log);
    const focusName = focus.skillName || focus.name || "Next skill";
    const focusReason = focus.reason || "Keep practising this skill";
    const focusCompetency = focus.competencyName || "";
    const focusExtra = document.createElement("b");
    focusExtra.textContent = focusName;
    const focusHost = $("nextFocus");
    focusHost.textContent = "";
    focusHost.append(focusExtra, document.createTextNode(
      focus.score === null || focus.score === undefined
        ? ` — ${focusReason}.`
        : ` (${Math.round(focus.score * 100)}%) — ${focusReason}${focusCompetency ? ` · ${focusCompetency}` : ""}.`
    ));

    // history
    const hist = $("sessionList");
    hist.textContent = "";
    if (!log.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No sessions logged yet.";
      hist.appendChild(li);
    }
    log.slice().reverse().forEach((s, idxRev) => {
      const realIdx = log.length - 1 - idxRev;
      const d = new Date(s.date).toLocaleDateString();
      const marks = Object.values(s.skills || {});
      const good = marks.filter((r) => r === "good").length;
      const ok = marks.filter((r) => r === "ok").length;
      const poor = marks.filter((r) => r === "poor").length;
      const li = document.createElement("li");
      li.className = "pl-session";
      const head = document.createElement("div");
      head.className = "pl-session-head";
      const when = document.createElement("span");
      const b = document.createElement("b");
      b.textContent = d;
      when.append(b, document.createTextNode(` · ${s.minutes} min`));
      const marksEl = document.createElement("span");
      marksEl.className = "pl-marks";
      marksEl.textContent = `✓${good} △${ok} ✗${poor}`;
      head.append(when, marksEl);
      const meta = document.createElement("div");
      meta.className = "outcome-meta";
      const tags = s.conditions.concat(s.roadTypes).join(" · ");
      meta.textContent = (tags || "—") + (s.notes ? ` · ${s.notes.slice(0, 120)}` : "");
      const del = document.createElement("button");
      del.className = "btn ghost pl-del";
      del.dataset.i = String(realIdx);
      del.setAttribute("aria-label", "Delete session");
      del.textContent = "Delete";
      li.append(head, meta, del);
      hist.appendChild(li);
    });
    hist.querySelectorAll(".pl-del").forEach((btn) => on(btn, "click", () => {
      removeSession(Number(btn.dataset.i));
    }));

    // form defaults once
    if ($("plDate") && !$("plDate").value) $("plDate").value = todayStr();
  }

  window.RoadReadyPracticalUI = {
    /** @param {{Core, form, getState, save, render, toast, todayStr, readiness}} deps */
    init(deps) { ctx = deps; },
    render,
    buildForm,
    saveSession,
    removeSession,
  };
})();
