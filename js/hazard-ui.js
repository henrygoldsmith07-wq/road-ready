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
  function renderTimeline(sc, presses, analysis) {
    const host = $("hzTimeline");
    if (!host) return;
    const dur = sc.max || 1;
    const pct = (t) => Math.max(0, Math.min(100, (100 * t) / dur));
    host.textContent = "";

    const track = document.createElement("div");
    track.className = "hz-tl-track";
    track.setAttribute("aria-hidden", "true");
    const win = document.createElement("div");
    win.className = "hz-tl-window";
    win.style.setProperty("left", pct(sc.win[0]).toFixed(2) + "%");
    win.style.setProperty("width", (pct(sc.win[1]) - pct(sc.win[0])).toFixed(2) + "%");
    track.appendChild(win);
    for (const t of presses) {
      const mark = document.createElement("span");
      mark.className = "hz-tl-mark";
      mark.style.setProperty("left", pct(t).toFixed(2) + "%");
      track.appendChild(mark);
    }

    const axis = document.createElement("div");
    axis.className = "hz-tl-axis";
    axis.setAttribute("aria-hidden", "true");
    const a0 = document.createElement("span");
    a0.textContent = "0s";
    const a1 = document.createElement("span");
    a1.textContent = dur.toFixed(1) + "s";
    axis.append(a0, a1);

    const txt = document.createElement("p");
    txt.className = "hz-tl-text";
    txt.textContent = HZS.timelineText(sc, analysis, presses);

    host.append(track, axis, txt);
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
      i: 0, analyses: [], presses: [], totalPts: 0,
      phase: "intro", running: false, timer: null, countdownTimer: null,
      beginScene: null, lastPress: null,
    };

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
    run.phase = "countdown";
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
      run.phase = "running";
      run.t0 = performance.now();
      run.timer = setInterval(() => {
        const t = (performance.now() - run.t0) / 1000;
        const q = reducedMotion() ? Math.floor(t * 2) / 2 : t;
        const svgNow = $("hzSvg");
        if (svgNow) svgNow.innerHTML = HZS.buildScene(q, sc);
        if (t >= sc.max) endScenario(sc);
      }, 60);
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
    clearInterval(run.timer);
    run.running = false;
    run.phase = "verdict";
    const presses = run.presses[run.i].slice().sort((a, b) => a - b);
    const analysis = ctx.Core.hazardAnalysis(sc.name, presses, sc.win[0], sc.win[1]);
    run.analyses[run.i] = analysis;
    run.totalPts += analysis.pts;
    renderTimeline(sc, presses, analysis);

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

    showOverlay(`
      <div class="ov-inner">
        <p class="ov-count">${run.i + 1} / ${run.session.length} · ${esc(sc.name)}</p>
        <div class="ov-pts ${analysis.pts ? "" : "zero"}">${analysis.pts ? "+" + analysis.pts : "0"} pts</div>
        <p><b>${esc(verdict)}</b></p>
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
    run.phase = "results";
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
