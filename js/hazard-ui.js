/* Road Ready — hazard-perception game UI.
 *
 * Extracted from app.js: everything about running the hazard-identification
 * training session (the intro/verdict/results overlays, the animated SVG
 * stage, the per-scenario timeline, the text alternative, the keyboard and
 * touch controls, and the state writes). Business rules stay in js/core.js
 * (hazardScore / hazardAnalysis / hazardFeedback / hazardSummary /
 * HAZARD_PRESS_CAP) and the scene data + drawing live in js/hazard-scenarios.js.
 *
 * Classic-script module: an IIFE factory receives its dependencies explicitly
 * from app.js via RoadReadyHazardUI.init(ctx) instead of reaching into hidden
 * shared globals. Everything is original training material — the copy must
 * never claim DVSA scoring or official clips.
 *
 * ---- init(ctx) contract ------------------------------------------------
 * ctx = {
 *   Core,                   // js/core.js export (hazardScore, hazardAnalysis,
 *                           //   hazardFeedback, hazardSummary, HAZARD_PRESS_CAP,
 *                           //   XP_PER_HAZARD_POINT)
 *   Scenarios,              // optional js/hazard-scenarios.js export; defaults
 *                           //   to globalThis.RoadReadyHazardScenarios
 *   getState,               // () => mutable app state object
 *   save,                   // () => persist state
 *   showView,               // (name) => route to .view#view-<name>
 *   toast,                  // (title, sub, icon) => notification
 *   icon,                   // (name, size) => SVG string
 *   addXP,                  // (n) => grant XP
 *   unlock,                 // (id) => unlock achievement ("hawk")
 *   checkProgressAchievements, // () => recompute achievements
 *   hazardInfoForPack,      // () => {includedInExam, officialFormat?}
 *   termsForPack,           // () => {examName, ...}
 *   renderHome,             // () => refresh the home card labels
 *   escapeHTML,             // (s) => escaped string
 * }
 *
 * ---- DOM contract ------------------------------------------------------
 * The module renders ALL inner HTML of #view-hazard (the shell <section
 * id="view-hazard"> stays in index.html) and owns these ids:
 *   #hazardSub          – intro line, pack-aware (updated at start())
 *   #hzAccessibleList   – <details> text alternative (window + clicks text)
 *   #hzStage            – the scene card
 *   #hzSvg              – the SVG canvas (viewBox 0 0 360 420)
 *   #hzFlash            – "hazard missed" marker layer (shown on a miss)
 *   #hzOverlay          – intro / countdown / verdict / results overlays
 *   #hzActions          – controls row
 *   #hzQuit             – exit button
 *   #hzSlow             – big "SLOW DOWN" reaction button (>=44px)
 *   #hzTimeline         – per-scenario timeline (window + click markers)
 *   #hzVerdict          – verdict line (role=status, doubles as live text)
 *   #hzLive             – aria-live announcer for transitions/verdicts
 *   #hzProgress         – "n / total" text
 * Public API: start() (entry point from the home card), stop(), render().
 *
 * Timeline marker positions are set through the CSSOM (element.style.setProperty)
 * rather than style="" attributes: the shipped CSP is style-src 'self', which
 * blocks inline style attributes but not CSSOM writes (same pattern as the
 * --w progress bars in js/app.js).
 *
 * Session phases: "intro" -> "countdown" -> "running" -> "verdict" ->
 * ... -> "results". Enter advances overlays (intro/countdown/verdict) and
 * Space always means "react"; when focus is on a <button>, the native
 * activation is the single trigger and the document handler stands down.
 */
"use strict";

(function () {
  let ctx = null;
  let HZS = null;

  /** @returns {any} element by id — vanilla app, DOM types vary per caller */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  /** Escape anything interpolated into our HTML strings. */
  function esc(s) { return ctx && ctx.escapeHTML ? ctx.escapeHTML(s) : String(s); }

  const reducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  /* ---------------- session state ---------------- */
  let run = null;
  let timers = [];

  function clearTimers() {
    for (const id of timers) {
      clearInterval(id);
      clearTimeout(id);
    }
    timers = [];
  }

  /**
   * Observable lifecycle state. The view carries `data-phase` so the flow is
   * deterministic and testable from outside: idle → intro → countdown →
   * running → verdict → … → results. Tests await this instead of sleeping.
   */
  function setPhase(phase) {
    if (!run) phase = "idle";
    run && (run.phase = phase);
    const view = $("view-hazard");
    if (view) view.dataset.phase = phase;
  }

  /* ---------------- overlay + announcements ---------------- */
  function showOverlay(html) {
    const ov = $("hzOverlay");
    if (!ov) return;
    ov.innerHTML = html;
    ov.classList.add("show");
  }
  function hideOverlay() {
    const ov = $("hzOverlay");
    if (ov) ov.classList.remove("show");
  }
  function announce(msg) {
    const live = $("hzLive");
    if (live) live.textContent = msg;
  }

  /* ---------------- accessible list (text alternative) ---------------- */
  function renderAccessibleList() {
    const host = $("hzAccessibleList");
    if (!host || !run) return;
    host.innerHTML = run.session.map((sc, i) => {
      const a = run.analyses[i];
      const timeline = a
        ? `<p><b>Timeline:</b> ${esc(HZS.timelineText(sc, a, run.presses[i]))}</p>`
        : `<p><b>Timeline:</b> the developing window runs from ${sc.win[0].toFixed(1)}s to ${sc.win[1].toFixed(1)}s of the ${sc.max.toFixed(1)}s scene.</p>`;
      const decoys = sc.decoys && sc.decoys.length
        ? `<p><b>Other situations that stayed harmless:</b></p><ul>${sc.decoys.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
        : "";
      return `<article class="hz-access-list">
        <b>${i + 1}. ${esc(sc.name)}${sc.multi ? " (multiple potential hazards)" : ""}</b>
        <p><b>Developing hazard:</b> ${esc(sc.hazard)}</p>
        <p><b>Early clues:</b></p><ul>${sc.clues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        ${decoys}
        ${timeline}
        <p><b>Best response:</b> ${esc(sc.response)}</p>
      </article>`;
    }).join("");
  }

  /* ---------------- timeline visual ---------------- */
  /* Positions via CSSOM only — the CSP blocks style="" attributes. */
  function renderTimeline(sc, presses, analysis, timing) {
    const host = $("hzTimeline");
    if (!host) return;
    const core = ctx.Core;
    const dur = sc.max || 1;
    const pct = (t) => Math.max(0, Math.min(100, (100 * t) / dur));
    const b = HZS.phaseBounds(sc);
    host.textContent = "";

    /* Phase arc: "Potential ───── Developing ───── Critical", each label
     * centred over its band. Background is the unlabelled lead-in. */
    const arc = document.createElement("div");
    arc.className = "hz-tl-arc";
    arc.id = "hzTlArc";
    arc.setAttribute("aria-hidden", "true");
    const arcLine = document.createElement("div");
    arcLine.className = "hz-tl-arc-line";
    arc.appendChild(arcLine);
    const arcSegs = [
      { label: "Potential", from: b.potStart, to: b.winStart },
      { label: "Developing", from: b.winStart, to: b.winEnd },
      { label: "Critical", from: b.winEnd, to: b.end },
    ];
    for (const seg of arcSegs) {
      const lab = document.createElement("span");
      lab.className = "hz-tl-arc-label";
      lab.textContent = seg.label;
      lab.style.setProperty("left", ((pct(seg.from) + pct(seg.to)) / 2).toFixed(2) + "%");
      arc.appendChild(lab);
    }

    const track = document.createElement("div");
    track.className = "hz-tl-track";
    track.setAttribute("aria-hidden", "true");
    const bands = [
      { cls: "hz-tl-seg-bg", from: 0, to: b.potStart },
      { cls: "hz-tl-seg-pot", from: b.potStart, to: b.winStart },
      { cls: "hz-tl-window", from: b.winStart, to: b.winEnd },
      { cls: "hz-tl-seg-crit", from: b.winEnd, to: b.end },
    ];
    for (const band of bands) {
      const el = document.createElement("div");
      el.className = band.cls;
      el.style.setProperty("left", pct(band.from).toFixed(2) + "%");
      el.style.setProperty("width", (pct(band.to) - pct(band.from)).toFixed(2) + "%");
      track.appendChild(el);
    }
    for (const t of presses) {
      const phase = core.hazardPhaseAt(t, sc.win[0], sc.win[1], b.potStart);
      const mark = document.createElement("span");
      mark.className = "hz-tl-mark " + (phase === "background" ? "hz-tl-mark-fp"
        : phase === "potential" ? "hz-tl-mark-early"
        : phase === "developing" ? "hz-tl-mark-hit" : "hz-tl-mark-late");
      mark.textContent = "▲";
      mark.style.setProperty("left", pct(t).toFixed(2) + "%");
      track.appendChild(mark);
    }

    const axis = document.createElement("div");
    axis.className = "hz-tl-axis";
    axis.setAttribute("aria-hidden", "true");
    const a0 = document.createElement("span");
    a0.textContent = "0s";
    const am = document.createElement("span");
    am.textContent = "▲ = your click";
    const a1 = document.createElement("span");
    a1.textContent = dur.toFixed(1) + "s";
    axis.append(a0, am, a1);

    const txt = document.createElement("p");
    txt.className = "hz-tl-text";
    txt.textContent = HZS.timelineText(sc, analysis, presses);

    host.append(arc, track, axis, txt);
  }

  /* ---------------- timing facts (phase framing) ---------------- */
  /* Built from Core.hazardTiming so the copy never invents a classification:
   * first-observation phase, correct anticipation (potential/developing),
   * window hit, late, missed, repeated clicks, and background false positives
   * called out as distinct from early anticipation. */
  function timingLines(timing, analysis) {
    const out = [];
    const b = HZS.phaseBounds({ win: [analysis.winStart, analysis.winEnd] });
    const fo = timing.firstObservation;
    if (fo == null) {
      out.push("No clicks: nothing is marked on the timeline.");
      out.push(`Missed: the hazard developed from ${b.winStart.toFixed(1)}s without a response.`);
      return out;
    }
    const p = timing.firstObservationPhase;
    const tag = p === "background" ? "a false positive"
      : p === "potential" ? "early anticipation"
      : p === "developing" ? "inside the developing window"
      : "late — the hazard was already fully under way";
    out.push(`First observation: ${fo.toFixed(1)}s — ${tag} (${p} phase).`);
    if (timing.anticipatory) {
      out.push("Correct anticipation: a click landed while the clues were only potential or the hazard was developing.");
    } else {
      out.push("No correct anticipation: no click landed in the potential or developing phase.");
    }
    const scoredLate = analysis.scoredPress != null && analysis.scoredPress > b.winEnd;
    if (timing.late || scoredLate) {
      out.push(`Detected late: the first click came after ${b.winEnd.toFixed(1)}s, once the hazard was fully under way.`);
    } else if (timing.windowHit) {
      out.push(`Window hit: your first click scored against the developing window (${b.winStart.toFixed(1)}s–${b.winEnd.toFixed(1)}s).`);
    } else if (timing.earlyClick) {
      out.push(fo >= b.potStart
        ? `Early anticipation: you had it spotted by ${fo.toFixed(1)}s in the potential phase — the points scale scores reactions from ${(b.winStart - 0.35).toFixed(2)}s, so this one scored 0, but the recognition is the skill being trained.`
        : `Too early to score: the click at ${fo.toFixed(1)}s came before any clue was on screen.`);
    }
    if (timing.repeatedClicks > 1) {
      out.push(`Repeated clicks: ${timing.repeatedClicks} in one scene — trained perception is one deliberate response.`);
    }
    if (analysis.excessive) {
      out.push("More than five clicks in one scene counts as excessive clicking in this training.");
    }
    if (timing.falsePositives > 0) {
      out.push(`False positives: ${timing.falsePositives} click${timing.falsePositives > 1 ? "s" : ""} in the background phase — reacting to scenery. Distinct from early anticipation, which is a click while real clues were showing.`);
    }
    return out;
  }

  /* ---------------- verdict copy (extends core feedback, still hedged) ---- */
  function verdictLine(sc, analysis) {
    let line = analysis.feedback;
    if (sc.multi && analysis.outcome === "window") {
      line += " Of the several situations on screen, you picked the one that actually developed.";
    } else if (sc.multi && analysis.outcome === "missed") {
      line += " Several situations looked plausible on screen — one of them did develop.";
    }
    return line;
  }

  /* ---------------- session flow ---------------- */
  function start() {
    HZS = ctx.Scenarios || (typeof globalThis !== "undefined" ? globalThis.RoadReadyHazardScenarios : null);
    if (!HZS) return;
    render();
    clearTimers();
    const pool = HZS.scenarios.slice();
    // Shuffled session of RUN_SIZE so a run's max stays under the 75-point
    // hazardBest clamp in core.js while the bank itself keeps 22+ scenes.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    run = {
      session: pool.slice(0, Math.min(HZS.RUN_SIZE, pool.length)),
      i: 0, analyses: [], presses: [], timings: [], totalPts: 0,
      phase: "intro", running: false, timer: null, countdownTimer: null,
      sceneEndTimer: null, beginScene: null, lastPress: null,
    };
    setPhase("intro");

    const sub = $("hazardSub");
    if (sub) {
      const hzInfo = ctx.hazardInfoForPack ? ctx.hazardInfoForPack() : {};
      const terms = ctx.termsForPack ? ctx.termsForPack() : {};
      const base = `Tap <b>SLOW</b> (or press <b>Space</b>) the moment a hazard starts to develop — before you'd need to brake hard. Earlier = more points. `;
      sub.innerHTML = hzInfo.includedInExam
        ? `${base}Core section of your ${esc(terms.examName)}${hzInfo.officialFormat ? ` (real test: ${esc(hzInfo.officialFormat)})` : ""} — this trainer builds the same early-spotting skill.`
        : `${base}Bonus training: your ${esc(terms.examName)} does not include this scored section, but the skill saves lives.`;
    }
    ctx.showView("hazard");
    renderAccessibleList();
    intro();
  }

  function intro() {
    const state = ctx.getState();
    const maxScore = run.session.length * 5;
    const best = state.hazardBest ? ` · best ${state.hazardBest}/${maxScore}` : "";
    showOverlay(`
      <div class="ov-inner">
        <span class="ov-ico">${ctx.icon("eye", 34)}</span>
        <h2>Hazard identification training</h2>
        <p>${run.session.length} original scenarios. One developing hazard each.<br>Tap <b>SLOW</b> — or press <b>Space</b> — as soon as the hazard starts to develop.</p>
        <p class="ov-dim">5 points for instant recognition, down to 1. Too early or too late scores 0${best}.</p>
        <button class="btn primary" id="hzGo">Start</button>
      </div>`);
    const go = $("hzGo");
    if (go) go.focus();
    on(go, "click", nextScenario);
    announce(`Hazard training ready: ${run.session.length} scenarios. Press Start or Enter to begin.`);
  }

  function nextScenario() {
    if (!run || run.phase === "results") return;
    if (run.i >= run.session.length) return results();
    const sc = run.session[run.i];
    run.presses[run.i] = [];
    run.lastPress = null;
    setPhase("countdown");
    const slow = $("hzSlow");
    if (slow) slow.classList.remove("pressed");
    const flash = $("hzFlash");
    if (flash) flash.hidden = true;
    const tl = $("hzTimeline");
    if (tl) tl.textContent = "";
    const vd = $("hzVerdict");
    if (vd) vd.textContent = "";
    const prog = $("hzProgress");
    if (prog) prog.textContent = `${run.i + 1} / ${run.session.length}`;
    showOverlay(`<div class="ov-inner"><p class="ov-count">${run.i + 1} / ${run.session.length}</p><h2>${esc(sc.name)}</h2><p class="ov-dim">Get ready…</p></div>`);
    const svg = $("hzSvg");
    if (svg) svg.innerHTML = HZS.buildScene(0, { objs: () => "", road: sc.road, tint: sc.tint });
    announce(`Scenario ${run.i + 1} of ${run.session.length}: ${sc.name}. Get ready.`);

    run.beginScene = () => {
      if (!run || run.phase !== "countdown") return;
      clearTimeout(run.countdownTimer);
      hideOverlay();
      setPhase("running");
      run.t0 = performance.now();
      // SCENE COMPLETION is a wall-clock timeout, never tied to the paint
      // loop: WebKit can starve a 60ms SVG-repaint interval, and if the end
      // check lived inside that loop a slow tab would never reach the
      // results. Painting is bounded separately below.
      run.sceneEndTimer = setTimeout(() => endScenario(sc), Math.ceil(sc.max * 1000) + 60);
      timers.push(run.sceneEndTimer);
      const stepMs = reducedMotion() ? 500 : 90;
      let lastPaint = -1;
      run.timer = setInterval(() => {
        const t = (performance.now() - run.t0) / 1000;
        // Skip repaints the browser could not keep up with — the scene clock
        // stays real-time, the animation simply coarsens under load.
        const q = reducedMotion() ? Math.floor(t * 2) / 2 : Math.round(t * (1000 / stepMs)) / (1000 / stepMs);
        if (q === lastPaint) return;
        lastPaint = q;
        const svgNow = $("hzSvg");
        if (svgNow) svgNow.innerHTML = HZS.buildScene(q, sc);
      }, stepMs);
      timers.push(run.timer);
    };
    const countdown = reducedMotion() ? 400 : 1400;
    run.countdownTimer = setTimeout(run.beginScene, countdown);
    timers.push(run.countdownTimer);
  }

  function press() {
    if (!run || run.phase !== "running") return;
    const t = (performance.now() - run.t0) / 1000;
    if (run.lastPress != null && t - run.lastPress < 0.05) return;
    run.lastPress = t;
    run.presses[run.i].push(t);
    const slow = $("hzSlow");
    if (slow) slow.classList.add("pressed");
  }

  function endScenario(sc) {
    if (!run || run.phase !== "running") return;
    clearTimers();
    run.running = false;
    setPhase("verdict");
    const presses = run.presses[run.i].slice().sort((a, b) => a - b);
    const analysis = ctx.Core.hazardAnalysis(sc.name, presses, sc.win[0], sc.win[1]);
    // Phase-aware timing: first observation, early anticipation vs false
    // positives, window hit, late, repeated clicks (Core.hazardTiming).
    const potentialStart = sc.phases && sc.phases.potential ? sc.phases.potential[0] : null;
    const timing = ctx.Core.hazardTiming(analysis, presses, sc.win[0], sc.win[1], potentialStart);
    run.analyses[run.i] = analysis;
    run.timings[run.i] = timing;
    run.totalPts += analysis.pts;
    renderTimeline(sc, presses, analysis, timing);

    const state = ctx.getState();
    if (!Array.isArray(state.hazardLog)) state.hazardLog = [];
    state.hazardLog.push({
      scenario: sc.name,
      press: analysis.scoredPress == null ? null : Number(analysis.scoredPress.toFixed(2)),
      band: analysis.band,
      pts: analysis.pts,
      at: Date.now(),
    });
    state.hazardLog = state.hazardLog.slice(-120);

    const verdict = verdictLine(sc, analysis);
    const vd = $("hzVerdict");
    if (vd) vd.textContent = verdict;
    if (analysis.outcome === "missed") {
      const flash = $("hzFlash");
      if (flash) flash.hidden = false;
    }
    announce(`${sc.name}: ${analysis.pts} points. ${verdict}`);
    renderAccessibleList();

    // Phase narrative + timing lines: why the click landed where it did.
    // phaseNarrative returns an array of phase-framed lines.
    const narrative = (HZS.phaseNarrative(sc, timing) || []).join(" ");
    const lines = timingLines(timing, analysis);

    showOverlay(`
      <div class="ov-inner">
        <p class="ov-count">${run.i + 1} / ${run.session.length} · ${esc(sc.name)}</p>
        <div class="ov-pts ${analysis.pts ? "" : "zero"}">${analysis.pts ? "+" + analysis.pts : "0"} pts</div>
        <p><b>${esc(verdict)}</b></p>
        ${narrative ? `<p class="ov-dim hz-narrative">${esc(narrative)}</p>` : ""}
        <ul class="hz-timing-lines">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <p class="ov-dim"><b>Developing hazard:</b> ${esc(sc.hazard)}</p>
        <p class="ov-dim"><b>Early clues:</b> ${esc(sc.clues.join(" · "))}</p>
        <p class="ov-dim"><b>Best response:</b> ${esc(sc.response)}</p>
        <p class="ov-dim">${esc(sc.tip)}</p>
        ${sc.decoys && sc.decoys.length ? `<p class="ov-dim"><b>Stayed harmless:</b> ${esc(sc.decoys.join(" · "))}</p>` : ""}
        <div class="ov-btns"><button class="btn primary" id="hzNext">Continue (Enter)</button></div>
      </div>`);
    const next = $("hzNext");
    if (next) { next.focus(); on(next, "click", nextScenario); }
    run.i++;
  }

  function results() {
    if (!run) return;
    clearTimers();
    setPhase("results");
    const core = ctx.Core;
    const state = ctx.getState();
    const maxScore = run.session.length * 5;
    const summary = core.hazardSummary(run.analyses);
    const counts = HZS.summaryCounts(run.analyses);
    const total = run.totalPts;
    const isNew = total > state.hazardBest;
    state.hazardBest = Math.min(75, Math.max(state.hazardBest, total));
    state.hazardPct = maxScore ? total / maxScore : 0;
    ctx.addXP(total * (core.XP_PER_HAZARD_POINT || 2));
    if (total >= Math.round(maxScore * 0.7)) ctx.unlock("hawk");
    ctx.save();
    ctx.checkProgressAchievements();
    if (ctx.renderHome) ctx.renderHome();

    const steps = HZS.nextSteps(summary, counts);
    // Skill by category, weakest first: the coachable picture of a run.
    const skillRows = core.hazardCategorySkill(run.analyses, (name) => {
      const sc = (HZS.scenarios || []).find((s) => s.name === name);
      return sc ? sc.category : null;
    });
    const skillLines = skillRows.map((r) => HZS.skillLine(r)).filter(Boolean);
    // categoryCoaching returns { lines, recommendation } — not an array.
    const coaching = HZS.categoryCoaching ? HZS.categoryCoaching(skillRows, HZS.scenarios) : { lines: [], recommendation: "" };
    const verdictCopy = summary.verdict === "sharp" ? "Sharp recognition this run."
      : summary.verdict === "developing" ? "Solid instincts — polish the early spots."
      : summary.verdict === "no-data" ? "No scenarios completed."
      : "Keep training — early recognition is the skill.";
    showOverlay(`
      <div class="ov-inner">
        <span class="ov-ico">${ctx.icon(total >= maxScore * 0.6 ? "trophy" : "eye", 34)}</span>
        <h2>${total} / ${maxScore}</h2>
        <p>${esc(verdictCopy)} This is training feedback, not an official result.</p>
        ${isNew ? `<p class="ov-dim">New personal best</p>` : `<p class="ov-dim">Best: ${state.hazardBest}/${maxScore}</p>`}
        <ul class="hz-sum-list">
          <li>Anticipatory responses: ${counts.anticipatory} · reactive: ${counts.reactive} · over-eager: ${counts.overEager}</li>
          <li>Missed hazards: ${summary.missed} · late recognitions: ${counts.lateRecognition} · excessive clicking: ${counts.excessive}</li>
        </ul>
        ${skillLines.length ? `<div class="hz-skill" id="hzSkillList"><p class="hz-skill-head">Skill by category (weakest first)</p><ul class="hz-skill-list">${skillLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
        ${coaching.lines.map((s) => `<p class="ov-dim"><b>Coach:</b> ${esc(s)}</p>`).join("")}
        ${coaching.recommendation ? `<p class="ov-dim"><b>Recommended next:</b> ${esc(coaching.recommendation)}</p>` : ""}
        ${steps.map((s) => `<p class="ov-dim"><b>Next step:</b> ${esc(s)}</p>`).join("")}
        <div class="ov-btns">
          <button class="btn primary" id="hzAgain">Train again</button>
          <button class="btn ghost" id="hzDone">Done</button>
        </div>
      </div>`);
    announce(`Session complete: ${total} of ${maxScore}. ${verdictCopy}`);
    if (isNew && ctx.toast) ctx.toast("New personal best", `${total}/${maxScore} in hazard training.`, "eye");
    on($("hzAgain"), "click", start);
    on($("hzDone"), "click", () => { stop(); if (ctx.renderHome) ctx.renderHome(); ctx.showView("home"); });
    const again = $("hzAgain");
    if (again) again.focus();
  }

  function stop() {
    clearTimers();
    run = null;
    setPhase("idle");
    hideOverlay();
    const flash = $("hzFlash");
    if (flash) flash.hidden = true;
    const slow = $("hzSlow");
    if (slow) slow.classList.remove("pressed");
  }

  /* ---------------- static render (shell internals) ---------------- */
  /** Rebuild the owned inner HTML of #view-hazard. Idempotent. */
  function render() {
    const host = $("view-hazard");
    if (!host || !ctx) return;
    host.innerHTML = `
      <h1 class="view-title">Hazard Perception</h1>
      <p class="view-sub" id="hazardSub">Tap <b>SLOW</b> (or press <b>Space</b>) the moment a hazard starts to develop — before you'd need to brake hard. Earlier = more points.</p>
      <details class="hz-access-details">
        <summary>Text-based hazard descriptions</summary>
        <div id="hzAccessibleList"></div>
      </details>
      <div class="hz-stage card" id="hzStage">
        <svg id="hzSvg" viewBox="0 0 360 420" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Animated hazard scene"></svg>
        <div class="hz-flash" id="hzFlash" hidden></div>
        <div class="hz-overlay" id="hzOverlay"></div>
      </div>
      <div class="hz-timeline-wrap">
        <p class="hz-progress" id="hzProgress"></p>
        <div id="hzTimeline"></div>
        <p class="hz-verdict" id="hzVerdict" role="status"></p>
      </div>
      <div class="hz-actions" id="hzActions">
        <button class="btn ghost" id="hzQuit">Exit</button>
        <button class="btn primary hz-slow" id="hzSlow">SLOW DOWN</button>
      </div>
      <p class="kbd-hint">Press <kbd>Space</kbd> to react · <kbd>Enter</kbd> to continue</p>
      <p class="hz-live" id="hzLive" aria-live="polite"></p>`;
    on($("hzSlow"), "click", press);
    on($("hzQuit"), "click", () => { stop(); if (ctx.renderHome) ctx.renderHome(); ctx.showView("home"); });
  }

  /* ---------------- global key handling (module-owned) ----------------
   * Enter advances overlays and Space reacts, but only when focus is NOT on
   * a <button>: a focused button already activates natively on Enter/Space,
   * so handling it here too would double-fire (double presses, double
   * scenario advances). The native click is the single trigger in that case. */
  function keyHandler(e) {
    const view = $("view-hazard");
    if (!view || !view.classList.contains("active") || !run) return;
    const el = e.target;
    const onControl = !!(el && typeof el.closest === "function" && el.closest("button"));
    if (e.key === " " || e.key === "Spacebar") {
      if (onControl || e.repeat) return;
      e.preventDefault();
      press();
    } else if (e.key === "Enter") {
      if (onControl) return;
      if (run.phase === "intro" || run.phase === "verdict") nextScenario();
      else if (run.phase === "countdown" && run.beginScene) run.beginScene();
    }
  }
  if (typeof document !== "undefined") document.addEventListener("keydown", keyHandler);

  window.RoadReadyHazardUI = {
    /** @param {{Core, Scenarios?, getState, save, showView, toast, icon, addXP,
     *           unlock, checkProgressAchievements, hazardInfoForPack,
     *           termsForPack, renderHome, escapeHTML}} deps */
    init(deps) { ctx = deps; render(); },
    start,
    stop,
    render,
  };
})();
