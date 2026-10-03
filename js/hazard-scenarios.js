/* Road Ready — hazard-perception scenario bank + SVG scene builders.
 *
 * 35 ORIGINAL training scenes plus the lightweight SVG string builders that
 * draw them. Nothing here is official DVSA content: the scenes are ours, the
 * score scale is ours, and no copy may ever claim official scoring or
 * official clips. Business rules (scoring, analytics, summary) live in
 * js/core.js; this file is data + drawing + deterministic display copy.
 *
 * Classic-script module in the browser (globalThis.RoadReadyHazardScenarios)
 * and a plain CommonJS module under node (module.exports), exactly the
 * js/packs/uk.js pattern, so tests can require() this file directly.
 *
 * Scenario shape:
 *   { name, category, road, tint, phases, win:[startSec,endSec], max, hazard,
 *     clues[], response, tip, objs(t), decoys?, multi? }
 *   - phases: { potential: [startSec, endSec] } — the "potential" phase of the
 *     perception arc (Core.hazardPhaseAt semantics): early clues are visible
 *     but nothing is directed at your path yet. potential[1] === win[0]
 *     exactly (tests enforce this), so the arc reads background -> potential
 *     -> developing (win[0]) -> critical (win[1]). Long potential windows
 *     train the discipline of WAITING: a click there is early anticipation,
 *     a click before potential[0] is a false positive.
 *   - win: the developing window. The hazard begins to threaten your path at
 *     win[0] and is fully under way by win[1]. Always 0 <= win[0] < win[1]
 *     <= max (tests enforce this).
 *   - max: scenario length in seconds.
 *   - category: one of the training skill categories (children,
 *     parked-vehicles, traffic, animals, pedestrians, cyclists,
 *     motorcyclists, junctions, roundabouts, merging, concealed, roadworks,
 *     emergency, rain, darkness, country-roads, buses, delivery-vehicles,
 *     multiple-hazards). Tests assert every scenario's category is in this
 *     set; js/hazard-ui.js rolls skill rows up from it via
 *     Core.hazardCategorySkill.
 *   - road: scene geometry — "straight" | "residential" | "rural" | "bend"
 *     | "roundabout" | "hatched".
 *   - tint: colour grading — null | "rain" | "dark" | "wet" | "fog".
 *   - objs(t): SVG string for the scenario's own objects at t seconds.
 *   - decoys: multi-hazard scenes only. The OTHER plausible situations on
 *     screen — they stay harmless while exactly one hazard develops. Judging
 *     which one is the decision-uncertainty training; the test suite asserts
 *     every multi-hazard scene declares them.
 *   - distractorScene: true on a scene whose everyday look is pure scenery —
 *     nothing on screen ever develops except the one declared hazard late in
 *     the scene. These train the discipline of not clicking at a watched
 *     scene; the test suite asserts at least one exists.
 */
/* exported RoadReadyHazardScenarios */
"use strict";

(function (root) {
  "use strict";

  /* ---------------- geometry constants ---------------- */
  const HZ = { V: 110, W: 360, H: 420, RL: 96, RR: 264, CARX: 158, CARY: 344 };
  /** Scroll position of an object spawned at ts (top of scene) at time t. */
  function hzY(t, ts) { return -46 + HZ.V * (t - ts); }
  /** Scenarios drawn per session. state.hazardBest is clamped to 75 in
   *  js/core.js, so a session (12 x 5 = 60 pts max) must stay under that. */
  const RUN_SIZE = 12;

  /* ---------------- SVG string primitives ---------------- */
  function hzRR(x, y, w, h, fill, rx, extra) {
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${rx || 4}" fill="${fill}" ${extra || ""}/>`;
  }
  function hzC(x, y, r, fill) { return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`; }
  function hzRing(x, y, r, stroke, w) {
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
  }
  function hzPoly(points, fill) {
    const d = points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    return `<polygon points="${d}" fill="${fill}"/>`;
  }

  /* ---------------- people ---------------- */
  function hzPerson(x, y) { return hzC(x, y, 7, "#e8e8ec") + hzRR(x - 6, y + 6, 12, 16, "#8b8b93", 4) + hzRR(x - 8, y + 8, 16, 4, "#c1272d", 2); }
  function hzChild(x, y) { return hzC(x, y, 5, "#e8e8ec") + hzRR(x - 4, y + 5, 9, 11, "#c1272d", 3) + hzRR(x - 6, y + 6, 12, 3, "#e8e8ec", 1); }
  function hzUmbrella(x, y) {
    return hzPoly([[x - 15, y - 7], [x + 15, y - 7], [x + 8, y - 15], [x - 8, y - 15]], "#3f5a8a")
      + hzRR(x - 1, y - 8, 2, 12, "#8b8b93", 1) + hzC(x, y + 6, 7, "#e8e8ec") + hzRR(x - 6, y + 12, 12, 14, "#3f5a8a", 4);
  }
  function hzPhone(x, y) { return hzC(x, y, 7, "#e8e8ec") + hzRR(x - 6, y + 6, 12, 16, "#8b8b93", 4) + hzRR(x + 2, y + 2, 5, 8, "#5a7ea8", 1); }
  function hzWorker(x, y) { return hzC(x, y, 7, "#e8e8ec") + hzRR(x - 6, y + 6, 12, 16, "#e07b18", 4) + hzRR(x - 6, y + 11, 12, 3, "#e8e8ec", 1); }

  /* ---------------- animals ---------------- */
  function hzDeer(x, y) { return hzRR(x - 16, y - 6, 34, 14, "#8a6d4f", 6) + hzRR(x + 14, y - 12, 12, 8, "#8a6d4f", 3) + hzRR(x - 12, y + 8, 4, 10, "#6f573d", 1) + hzRR(x + 6, y + 8, 4, 10, "#6f573d", 1); }
  function hzHorse(x, y) {
    return hzRR(x - 18, y - 8, 38, 16, "#7a6248", 6) + hzRR(x + 16, y - 20, 12, 14, "#7a6248", 4)
      + hzRR(x - 12, y + 8, 5, 12, "#5f4c38", 1) + hzRR(x + 8, y + 8, 5, 12, "#5f4c38", 1)
      + hzRR(x - 5, y - 24, 11, 15, "#e8e8ec", 4) + hzC(x, y - 29, 5, "#e8e8ec");
  }
  function hzDog(x, y) { return hzRR(x - 9, y - 4, 18, 8, "#c9c9d1", 4) + hzRR(x + 8, y - 9, 7, 7, "#c9c9d1", 3) + hzRR(x - 12, y - 9, 4, 7, "#c9c9d1", 2) + hzRR(x - 6, y + 4, 3, 6, "#c9c9d1", 1) + hzRR(x + 4, y + 4, 3, 6, "#c9c9d1", 1); }
  function hzCat(x, y) { return hzRR(x - 6, y - 4, 13, 9, "#8b8b93", 4) + hzC(x + 7, y - 8, 4, "#8b8b93") + hzRR(x - 9, y - 13, 3, 10, "#8b8b93", 1); }
  function hzBall(x, y) { return hzC(x, y, 7, "#c1272d") + hzC(x - 2, y - 2, 2, "rgba(255,255,255,.35)"); }

  /* ---------------- vehicles ---------------- */
  function hzCarAhead(x, y, braking) {
    let s = hzRR(x - 20, y, 40, 58, "#4a4a55", 6) + hzRR(x - 14, y + 8, 28, 16, "#26262e", 3);
    if (braking) s += hzC(x - 12, y + 54, 4, "#c1272d") + hzC(x + 12, y + 54, 4, "#c1272d");
    return s;
  }
  function hzParkedAt(x, y, w, h) { return hzRR(x, y, w, h, "#3a3a44", 6) + hzRR(x + 4, y + 8, w - 8, Math.min(18, h / 3), "#26262e", 3); }
  function hzParked(y) { return hzParkedAt(226, y, 34, 64); }
  function hzDoor(y, k) { return hzRR(226 - 24 * k, y + 14, 24 * k, 34, "#8b8b93", 3); }
  function hzVan(x, y) { return hzRR(x - 28, y, 56, 84, "#4d4d58", 7) + hzRR(x - 22, y + 8, 20, 22, "#222229", 4); }
  function hzDelivery(x, y) {
    return hzVan(x, y) + hzRR(x - 28, y + 40, 56, 4, "#8b8b93", 1)
      + hzRR(x - 34, y + 44, 12, 26, "#6b6b76", 2) + hzRR(x - 46, y + 70, 9, 9, "#b98a4e", 2);
  }
  function hzIceCream(x, y) {
    let s = hzVan(x, y) + hzRR(x - 22, y + 34, 44, 18, "#e8e8ec", 2);
    for (let i = 0; i < 4; i++) s += hzRR(x - 22 + i * 11, y + 34, 5, 18, "#c1272d", 1);
    s += hzRR(x - 8, y - 14, 16, 12, "#e8e8ec", 3) + hzC(x, y - 18, 7, "#c1272d");
    return s;
  }
  function hzBus(x, y, opts) {
    const o = opts || {};
    let s = hzRR(x - 26, y, 52, 120, "#4a4a55", 6) + hzRR(x - 20, y + 10, 40, 24, "#222229", 3);
    for (let i = 0; i < 3; i++) s += hzRR(x - 23, y + 44 + i * 22, 17, 12, "#222229", 2) + hzRR(x + 6, y + 44 + i * 22, 17, 12, "#222229", 2);
    if (o.indicate && Math.floor((o.t || 0) * 3) % 2 === 0) s += hzRR(x - 32, y + 100, 7, 7, "#e07b18", 2);
    return s;
  }
  function hzMotorcycle(x, y) { return hzRR(x - 4, y - 5, 10, 14, "#e8e8ec", 3) + hzC(x - 4, y + 11, 5, "#0b0b0d") + hzC(x + 7, y + 11, 5, "#0b0b0d"); }
  function hzCyclist(x, y) { return hzRR(x - 5, y - 8, 12, 14, "#e8e8ec", 4) + hzC(x - 10, y + 12, 6, "#0b0b0d") + hzC(x + 12, y + 12, 6, "#0b0b0d") + hzRR(x - 16, y - 4, 8, 3, "#8b8b93", 1); }
  function hzOncoming(t, ts, x, opts) {
    const o = opts || {};
    const y = -70 + (HZ.V + 150) * (t - ts);
    return hzRR(x - 20, y, 40, 58, o.color || "#3f3f4a", 6) + hzRR(x - 14, y + 34, 28, 16, "#26262e", 3)
      + hzC(x - 12, y + 6, 4, "#f0e6c8") + hzC(x + 12, y + 6, 4, "#f0e6c8");
  }

  /* ---------------- street furniture & markings ---------------- */
  function hzCrosswalk(y) {
    let s = "";
    for (let i = 0; i < 5; i++) s += hzRR(102, y + i * 15, 156, 8, "rgba(255,255,255,.75)", 2);
    return s;
  }
  function hzJunctionSide(y, side) {
    const x = side === "left" ? 20 : HZ.RR - 20;
    return hzRR(x, y, 76, 4, "rgba(255,255,255,.45)", 1) + hzRR(x, y + 7, 4, 4, "rgba(255,255,255,.45)", 1) + hzRR(x, y + 14, 4, 4, "rgba(255,255,255,.45)", 1);
  }
  function hzJunction(y) { return hzJunctionSide(y, "right"); }
  function hzMergeLine(y) { return hzRR(214, y, 4, 108, "rgba(255,255,255,.35)", 1) + hzRR(214, y + 114, 4, 4, "rgba(255,255,255,.35)", 1); }
  function hzCones(y) { let s = ""; for (let i = 0; i < 3; i++) { const cy = y + i * 26; s += hzC(204 + (i % 2) * 7, cy, 6, "#e07b18") + hzRR(199 + (i % 2) * 7, cy + 5, 12, 3, "#e07b18", 1); } return s; }
  function hzBarrier(y) {
    let s = hzRR(196, y, 60, 8, "#e8e8ec", 2);
    for (let i = 0; i < 3; i++) s += hzRR(200 + i * 20, y, 8, 8, "#c1272d", 1);
    return s;
  }
  function hzBlueLights(x, y) { return hzC(x - 14, y + 2, 5, "#4287f5") + hzC(x + 14, y + 2, 5, "#4287f5"); }
  function hzHedge(x, y, w, h) {
    return hzRR(x, y, w, h, "#232a20", 8) + hzRR(x + w * 0.2, y - 6, w * 0.5, 10, "#2b3427", 6)
      + hzC(x + w * 0.25, y + h * 0.3, 9, "#2b3427") + hzC(x + w * 0.7, y + h * 0.6, 11, "#1e2419");
  }
  function hzBusStop(y) {
    return hzRR(296, y, 46, 8, "#3f3f4a", 2) + hzRR(298, y + 8, 5, 34, "#3f3f4a", 2) + hzRR(336, y + 8, 5, 34, "#3f3f4a", 2) + hzRR(304, y + 16, 28, 10, "#2b2b33", 2);
  }
  function hzLead(x1, y1, x2, y2) {
    return hzPoly([[x1, y1], [x1 + 2, y1], [x2 + 2, y2], [x2, y2]], "rgba(220,220,228,.7)");
  }
  function hzSign(x, y, fill) {
    return hzPoly([[x, y], [x - 13, y + 16], [x + 13, y + 16]], fill || "#c1272d") + hzRR(x - 2, y + 16, 4, 14, "#8b8b93", 1);
  }
  function hzLights(x, y, phase) {
    const col = phase === "red" ? "#c1272d" : phase === "amber" ? "#e07b18" : "#3fae5a";
    return hzRR(x - 12, y, 24, 58, "#222229", 6) + hzRR(x - 2, y + 58, 4, 14, "#8b8b93", 1)
      + hzC(x, y + 12, 7, phase === "red" ? col : "#3a3a44")
      + hzC(x, y + 30, 7, phase === "amber" ? col : "#3a3a44")
      + hzC(x, y + 48, 7, phase === "green" ? col : "#3a3a44");
  }
  function hzSpray(x, y) {
    let s = "";
    for (let i = 0; i < 5; i++) s += hzC(x - 26 + i * 13, y + (i % 2) * 6, 6 + (i % 3) * 3, "rgba(215,225,240,0.28)");
    return s;
  }
  function hzGlare(x, y) {
    let s = hzC(x, y, 16, "rgba(240,230,190,0.32)") + hzC(x, y, 9, "rgba(240,230,190,0.55)") + hzC(x, y, 4, "#f0e6c8");
    s += hzPoly([[x - 3, y], [x + 3, y], [x + 2, y + 70], [x - 2, y + 70]], "rgba(240,230,190,0.16)");
    return s;
  }
  function hzFence(x, y, w) {
    let s = hzRR(x, y, w, 6, "#3c3327", 2);
    for (let i = 0; i <= w; i += 18) s += hzRR(x + i - 2, y - 12, 5, 30, "#3c3327", 1);
    return s;
  }

  /* ---------------- scene geometry ---------------- */
  function hzStraightRoad(scroll) {
    const W = HZ.W, H = HZ.H, RL = HZ.RL, RR = HZ.RR;
    let s = hzRR(0, 0, W, H, "#101013");
    s += hzRR(RL - 18, 0, 18, H, "#1b1b21", 0) + hzRR(RR, 0, 18, H, "#1b1b21", 0);
    s += hzRR(RL, 0, RR - RL, H, "#17171c", 0);
    s += hzRR(RL - 4, 0, 4, H, "rgba(255,255,255,.25)", 0) + hzRR(RR, 0, 4, H, "rgba(255,255,255,.25)", 0);
    const mod = scroll % 46;
    for (let y = -46 + mod; y < H + 40; y += 46) s += hzRR(W / 2 - 2, y, 4, 24, "rgba(255,255,255,.28)", 1);
    const tm = scroll % 150;
    for (let k = -1; k < 4; k++) {
      const ty = k * 150 + tm - 30;
      s += hzC(44, ty, 13, "#1d1d24") + hzRR(41, ty + 8, 6, 12, "#141419", 2);
      s += hzC(316, ty + 75, 13, "#1d1d24") + hzRR(313, ty + 83, 6, 12, "#141419", 2);
    }
    return s;
  }
  function hzResidential(scroll) {
    let s = hzStraightRoad(scroll);
    const tm = scroll % 170;
    for (let k = -1; k < 4; k++) {
      const ty = k * 170 + tm - 40;
      s += hzRR(8, ty, 66, 84, "#191920", 3) + hzRR(18, ty + 12, 20, 22, "#232330", 2) + hzRR(46, ty + 12, 20, 22, "#232330", 2);
      s += hzRR(288, ty + 85, 64, 84, "#191920", 3) + hzRR(298, ty + 97, 20, 22, "#232330", 2);
    }
    return s;
  }
  function hzRural(scroll) {
    let s = hzRR(0, 0, HZ.W, HZ.H, "#101013");
    s += hzRR(0, 0, HZ.RL, HZ.H, "#1a2016", 0) + hzRR(HZ.RR, 0, HZ.W - HZ.RR, HZ.H, "#1a2016", 0);
    s += hzRR(HZ.RL, 0, HZ.RR - HZ.RL, HZ.H, "#16161b", 0);
    s += hzRR(HZ.RL - 3, 0, 3, HZ.H, "rgba(255,255,255,.2)", 0) + hzRR(HZ.RR, 0, 3, HZ.H, "rgba(255,255,255,.2)", 0);
    const mod = scroll % 52;
    for (let y = -52 + mod; y < HZ.H + 40; y += 52) s += hzRR(HZ.W / 2 - 2, y, 4, 26, "rgba(255,255,255,.22)", 1);
    const hm = scroll % 130;
    for (let k = -1; k < 5; k++) {
      const hy = k * 130 + hm - 30;
      s += hzHedge(10, hy, 74, 44) + hzHedge(286, hy + 62, 72, 46);
    }
    return s;
  }
  function hzBend(scroll) {
    const H = HZ.H, RL = HZ.RL, RR = HZ.RR, step = 14;
    const off = (y) => 26 * Math.sin((y + scroll * 0.35) / 95);
    let s = hzRR(0, 0, HZ.W, H, "#101013");
    const left = [], right = [];
    for (let y = -step; y <= H + step; y += step) left.push([RL + off(y), y]);
    for (let y = H + step; y >= -step; y -= step) right.push([RR + off(y), y]);
    s += hzPoly(left.concat(right), "#17171c");
    for (let y = -step; y <= H + step; y += step) {
      s += hzRR(RL - 18 + off(y), y, 20, step + 1, "#1b1b21", 0) + hzRR(RR + off(y), y, 20, step + 1, "#1b1b21", 0);
      s += hzRR(RL - 4 + off(y), y, 4, step + 1, "rgba(255,255,255,.22)", 0) + hzRR(RR + off(y), y, 4, step + 1, "rgba(255,255,255,.22)", 0);
    }
    const mod = scroll % 48;
    for (let y = -48 + mod; y < H + 40; y += 48) s += hzRR(HZ.W / 2 - 2 + off(y), y, 4, 24, "rgba(255,255,255,.26)", 1);
    const hm = scroll % 120;
    for (let k = -1; k < 5; k++) {
      const hy = k * 120 + hm - 30;
      s += hzHedge(2, hy + off(hy), 78, 48) + hzHedge(288, hy + 58 + off(hy), 70, 50);
    }
    return s;
  }
  function hzHatched(scroll) {
    let s = hzStraightRoad(scroll);
    const mod = scroll % 60;
    for (let y = -60 + mod; y < HZ.H + 40; y += 60) {
      s += hzPoly([[212, y], [232, y], [222, y + 26]], "rgba(255,255,255,.22)");
    }
    s += hzRR(210, 0, 3, HZ.H, "rgba(255,255,255,.28)", 0) + hzRR(238, 0, 3, HZ.H, "rgba(255,255,255,.28)", 0);
    return s;
  }
  function hzRoundaboutGeom() {
    const cx = 180, cy = 140, R = 58, lane = 98;
    let s = hzC(cx, cy, lane, "#17171c");
    s += hzRing(cx, cy, (R + lane) / 2 + 12, "rgba(255,255,255,.22)", 3);
    s += hzC(cx, cy, R + 10, "#1b1b21") + hzC(cx, cy, R, "#232a20") + hzC(cx, cy, R - 16, "#2b3427") + hzC(cx, cy, 14, "#1e2419");
    for (let i = -2; i <= 2; i++) {
      const a = Math.PI / 2 + i * 0.24;
      s += hzRR(cx + lane * Math.cos(a) - 3, cy + lane * Math.sin(a) - 3, 7, 7, "rgba(255,255,255,.5)", 1);
    }
    s += hzRR(HZ.RL, cy + lane, HZ.W, 18, "#1b1b21", 0) + hzRR(HZ.RL, 0, 20, cy + lane, "#1b1b21", 0) + hzRR(HZ.RR - 2, 0, 20, cy + lane, "#1b1b21", 0);
    return s;
  }

  /* ---------------- colour grading ---------------- */
  function hzTint(tint, t) {
    if (tint === "dark") {
      let s = `<rect x="0" y="0" width="${HZ.W}" height="${HZ.H}" fill="rgba(6,8,18,0.38)"/>`;
      s += hzPoly([[150, HZ.CARY], [96, 120], [264, 120], [210, HZ.CARY]], "rgba(240,230,190,0.07)");
      s += hzPoly([[158, HZ.CARY], [118, 160], [242, 160], [202, HZ.CARY]], "rgba(240,230,190,0.07)");
      return s;
    }
    if (tint === "rain") {
      let s = `<rect x="0" y="0" width="${HZ.W}" height="${HZ.H}" fill="rgba(60,80,110,0.18)"/>`;
      const sm = (t * 260) % 60;
      for (let i = 0; i < 12; i++) {
        const x = (i * 37 + sm * 0.4) % HZ.W, y = (i * 61 + sm * 1.6) % HZ.H;
        s += hzPoly([[x, y], [x + 3, y], [x + 1, y + 16], [x - 2, y + 16]], "rgba(255,255,255,0.10)");
      }
      s += hzRR(HZ.RL + 24, 0, 8, HZ.H, "rgba(200,215,235,0.06)", 0) + hzRR(HZ.RR - 40, 0, 8, HZ.H, "rgba(200,215,235,0.06)", 0);
      return s;
    }
    if (tint === "wet") {
      let s = `<rect x="0" y="0" width="${HZ.W}" height="${HZ.H}" fill="rgba(30,38,52,0.22)"/>`;
      s += hzRR(HZ.RL + 30, 0, 4, HZ.H, "rgba(220,230,245,0.10)", 0) + hzRR(HZ.RR - 44, 0, 4, HZ.H, "rgba(220,230,245,0.10)", 0);
      return s;
    }
    if (tint === "fog") return `<rect x="0" y="0" width="${HZ.W}" height="${HZ.H}" fill="rgba(150,155,165,0.28)"/>`;
    return "";
  }

  /* ---------------- scene builder ---------------- */
  /**
   * Full SVG scene string at time t for scenario sc. The UI drives animation
   * by re-rendering at ~60ms, or in discrete steps when the learner prefers
   * reduced motion (pass quantized t). Pure: same (t, sc) -> same string.
   */
  function hzScene(t, sc) {
    const scroll = HZ.V * t;
    let s = "";
    if (sc.road === "rural") s += hzRural(scroll);
    else if (sc.road === "bend") s += hzBend(scroll);
    else if (sc.road === "residential") s += hzResidential(scroll);
    else if (sc.road === "hatched") s += hzHatched(scroll);
    else if (sc.road === "roundabout") s += hzStraightRoad(scroll) + hzRoundaboutGeom();
    else s += hzStraightRoad(scroll);
    s += sc.objs(t);
    s += hzRR(HZ.CARX, HZ.CARY, 44, 66, "#e8e8ec", 10) + hzRR(HZ.CARX + 6, HZ.CARY + 10, 32, 14, "#0b0b0d", 4) + hzRR(HZ.CARX + 6, HZ.CARY + 40, 32, 10, "#b9b9c2", 3);
    s += hzTint(sc.tint, t);
    return s;
  }

  /* ---------------- scenario bank ---------------- */
  const HZ_SCENARIOS = [
    {
      name: "Ball & child", category: "children", road: "residential", tint: null,
      win: [2.6, 6.0], max: 7.6, phases: { potential: [1.1, 2.6] },
      hazard: "A child runs out from between parked vehicles while chasing a ball.",
      clues: ["A ball rolls into the road", "Parked vehicles block the view", "Residential street"],
      response: "Ease off immediately and prepare to stop; a child may follow the ball.",
      tip: "A rolling ball means a child is close behind — react the moment you see it.",
      objs: t => {
        let s = "";
        if (t >= 1.2) s += hzBall(300 - 50 * (t - 2.6), hzY(t, 2.6));
        if (t >= 4.0) s += hzChild(320 - 70 * (t - 4.0), hzY(t, 4.0));
        return s;
      },
    },
    {
      name: "Parked car door", category: "parked-vehicles", road: "residential", tint: null,
      win: [3.0, 5.6], max: 7.2, phases: { potential: [1.5, 3.0] },
      hazard: "A door opens from a parked vehicle into your path.",
      clues: ["A silhouette appears in the parked vehicle", "You are passing close to parked cars", "The gap narrows"],
      response: "Drop back or move left if clear and give the door zone space.",
      tip: "Pass beside the door zone — expect doors to open and leave a gap.",
      objs: t => {
        let s = hzParked(hzY(t, 2.0));
        if (t >= 3.2) s += hzDoor(hzY(t, 2.0), Math.min(1, (t - 3.2) / 1.1));
        return s;
      },
    },
    {
      name: "Brake lights ahead", category: "traffic", road: "straight", tint: null,
      win: [3.0, 5.1], max: 6.8, phases: { potential: [1.5, 3.0] },
      hazard: "Traffic ahead brakes suddenly after a crest.",
      clues: ["Brake lights appear ahead", "Following distance is short", "The view beyond the crest is limited"],
      response: "Ease off and increase your gap before the queue reaches you.",
      tip: "Brake lights far ahead are your first warning — ease off the gas early.",
      objs: t => {
        const y = hzY(t, 3.0) + (t > 3.6 ? 30 * (t - 3.6) * (t - 3.6) : 0);
        let s = hzCarAhead(178, y, t > 3.4 && Math.floor(t * 4) % 2 === 0);
        s += hzCarAhead(212, y - 82, false);
        s += hzOncoming(t, 0.4, 132);
        return s;
      },
    },
    {
      name: "Rural animal crossing", category: "animals", road: "rural", tint: null,
      win: [3.2, 4.9], max: 6.5, phases: { potential: [1.7, 3.2] },
      hazard: "An animal crosses from a rural verge, a second following it.",
      clues: ["Warning signs or open fields", "Movement at the road edge", "One animal often precedes another"],
      response: "Brake in your lane and be ready to stop; do not swerve at speed.",
      tip: "Where one animal crosses, more follow — brake in your lane, don't swerve.",
      objs: t => {
        let s = hzDeer(30 + (t >= 3.2 ? 60 * (t - 3.2) : 0), hzY(t, 1.6));
        if (t >= 3.9) s += hzDeer(10 + 60 * (t - 3.9), hzY(t, 1.6) + 34);
        return s;
      },
    },
    {
      name: "Waiting pedestrian", category: "pedestrians", road: "straight", tint: null,
      win: [3.0, 5.4], max: 7.0, phases: { potential: [1.5, 3.0] },
      hazard: "A pedestrian waiting at a crossing starts to move toward the road.",
      clues: ["Crosswalk markings ahead", "A person waits near the kerb", "Their attention is on traffic, not you"],
      response: "Slow down before they step out and prepare to give way.",
      tip: "A waiting pedestrian plus a crosswalk = slow now, not when they step out.",
      objs: t => {
        let s = hzCrosswalk(hzY(t, 1.4));
        s += hzPerson(292 - (t >= 4.0 ? 60 * (t - 4.0) : 0), hzY(t, 1.4) + 8);
        return s;
      },
    },
    {
      name: "Cyclist ahead", category: "cyclists", road: "residential", tint: null,
      win: [2.6, 4.6], max: 6.2, phases: { potential: [1.1, 2.6] },
      hazard: "A cyclist moves around a parked vehicle into your lane.",
      clues: ["The cyclist looks over their shoulder", "A parked vehicle narrows the lane", "No safe passing gap yet"],
      response: "Ease off and hold back until you can pass with at least 1.5 metres.",
      tip: "Riders swerve for hazards you can't see — give them room to do it.",
      objs: t => hzCyclist(246 - (t >= 2.6 ? 38 * (t - 2.6) : 0), hzY(t, 1.8)),
    },
    {
      name: "Emerging vehicle", category: "junctions", road: "residential", tint: null,
      win: [2.8, 5.0], max: 6.8, phases: { potential: [1.3, 2.8] },
      hazard: "A vehicle emerges from a side road into your path.",
      clues: ["A junction is ahead", "Wheels move before the vehicle appears", "The side-road view is partly blocked"],
      response: "Cover the brake and prepare to slow; give the emerging driver time to react.",
      tip: "At junctions, watch wheels and nose movement — they often move before the car appears.",
      objs: t => {
        let s = hzJunction(hzY(t, 1.2)) + hzHedge(292, hzY(t, 1.2) - 66, 60, 52);
        const k = Math.min(1, Math.max(0, (t - 2.8) / 1.5));
        if (t >= 2.8) s += hzCarAhead(126 + 45 * k, hzY(t, 1.2) + 18, false);
        return s;
      },
    },
    {
      name: "Merging traffic", category: "merging", road: "hatched", tint: null,
      win: [3.1, 5.5], max: 7.0, phases: { potential: [1.6, 3.1] },
      hazard: "A vehicle accelerates down a slip road into your lane.",
      clues: ["A merge arrow or slip road appears", "The other vehicle's speed is still changing", "Your lane becomes the through lane"],
      response: "Adjust speed or change lane early; avoid competing for the same space.",
      tip: "Merge conflicts are about space and speed — make room before the lane line ends.",
      objs: t => {
        let s = hzMergeLine(hzY(t, 1.6));
        const k = Math.min(1, Math.max(0, (t - 3.1) / 1.7));
        s += hzCarAhead(92 + 88 * k, hzY(t, 1.6) + 30, false);
        s += hzOncoming(t, 0.2, 138);
        return s;
      },
    },
    {
      name: "Motorcycle filtering", category: "motorcyclists", road: "straight", tint: null,
      win: [2.9, 4.9], max: 6.5, phases: { potential: [1.4, 2.9] },
      hazard: "A motorcycle filters between slow vehicles into your lane.",
      clues: ["A narrow moving shape appears between vehicles", "Traffic ahead is slow", "Mirror checks are essential"],
      response: "Hold steady, check mirrors, and leave room; do not move suddenly.",
      tip: "Filtering riders rely on predictable drivers — avoid abrupt lane movement.",
      objs: t => {
        const k = Math.min(1, Math.max(0, (t - 2.9) / 1.4));
        let s = hzCarAhead(118, hzY(t, 1.1), false) + hzCarAhead(238, hzY(t, 1.4), false);
        s += hzMotorcycle(132 + 66 * k, hzY(t, 1.5));
        return s;
      },
    },
    {
      name: "Restricted visibility", category: "concealed", road: "residential", tint: null,
      win: [3.0, 5.2], max: 6.8, phases: { potential: [0.6, 3.0] },
      hazard: "A parked van blocks your view of a crossing pedestrian.",
      clues: ["A large vehicle hides the near-side view", "A school or shop is nearby", "Speed makes the hidden risk worse"],
      response: "Slow until you can see past the obstruction and be ready to stop.",
      tip: "If you cannot see, assume something may be there — slow to see.",
      objs: t => {
        let s = hzVan(220, hzY(t, 1.4));
        if (t >= 4.0) s += hzPerson(302 - 70 * (t - 4.0), hzY(t, 1.4) + 10);
        return s;
      },
    },
    {
      name: "Roadworks ahead", category: "roadworks", road: "straight", tint: null,
      win: [3.0, 5.3], max: 6.9, phases: { potential: [1.5, 3.0] },
      hazard: "Workers and cones narrow the carriageway.",
      clues: ["Temporary cones appear", "Signals or workers are present", "Lanes merge ahead"],
      response: "Reduce speed before the cone taper and follow the temporary lane.",
      tip: "Treat roadworks as a speed problem first — deal with the merge second.",
      objs: t => {
        let s = hzCones(hzY(t, 1.5)) + hzBarrier(hzY(t, 1.5) - 34) + hzSign(300, hzY(t, 1.5) - 66, "#e07b18");
        if (t >= 3.4) s += hzWorker(278, hzY(t, 1.5) + 5);
        return s;
      },
    },
    {
      name: "Emergency vehicle", category: "emergency", road: "straight", tint: null,
      win: [2.8, 4.8], max: 6.4, phases: { potential: [0.4, 2.8] },
      hazard: "An emergency vehicle approaches from behind while the road ahead narrows.",
      clues: ["Flashing blue lights in mirrors", "Traffic starts pulling right", "Sirens change direction"],
      response: "Check mirrors, then pull right or stop where it is safe and legal.",
      tip: "Never block a junction to make room — move right only when it is safe.",
      objs: t => {
        const k = Math.min(1, Math.max(0, (t - 2.8) / 1.5));
        let s = hzCarAhead(168, 70 + 90 * (1 - k), false);
        if (t >= 2.8) s += hzBlueLights(168, 70 + 90 * (1 - k));
        return s;
      },
    },
    {
      name: "Roundabout approach", category: "roundabouts", road: "roundabout", tint: null,
      win: [2.9, 5.0], max: 6.6, phases: { potential: [1.4, 2.9] },
      hazard: "A vehicle already on the roundabout cuts across your entry path without signalling.",
      clues: ["A vehicle circulates without an indicator", "Its position suggests your exit", "Give-way markings at the entry"],
      response: "Hold back at the give-way line until its path is clear of your entry.",
      tip: "On a roundabout, read position and wheels — a missing signal often hides the move.",
      objs: t => {
        const a = 2.35 - 0.17 * t;
        let s = hzCarAhead(180 + 84 * Math.cos(a), 140 + 84 * Math.sin(a), t > 3.6);
        s += hzPerson(300, 300);
        return s;
      },
    },
    {
      name: "Rainy crossing", category: "rain", road: "residential", tint: "rain",
      win: [3.0, 5.4], max: 7.0, phases: { potential: [1.5, 3.0] },
      hazard: "A pedestrian with an umbrella steps out from behind a parked van, hidden until the last moment.",
      clues: ["Rain reduces visibility and grip", "The umbrella blocks the pedestrian's own view", "Wet roads lengthen stopping distance"],
      response: "Ease off early, cover the brake, and allow for longer stopping distances.",
      tip: "In rain, assume the hidden pedestrian has not seen or heard you.",
      objs: t => {
        let s = hzVan(224, hzY(t, 1.6));
        if (t >= 3.6) s += hzUmbrella(308 - 66 * (t - 3.6), hzY(t, 1.6) + 12);
        s += hzOncoming(t, 0.6, 126);
        return s;
      },
    },
    {
      name: "Unlit cyclist at night", category: "darkness", road: "straight", tint: "dark",
      win: [2.8, 5.0], max: 6.6, phases: { potential: [1.3, 2.8] },
      hazard: "A cyclist without lights rides along the near-side kerb, visible only in your headlights.",
      clues: ["Darkness narrows what you can see", "A faint shape moves at the road edge", "No rear light is visible"],
      response: "Hold back, pass wide only when clear, and be ready for them to swerve.",
      tip: "At night, a missing light is the warning — treat dark shapes near the kerb as people.",
      objs: t => {
        let s = hzCyclist(242 - (t >= 2.8 ? 30 * (t - 2.8) : 0), hzY(t, 1.7));
        s += hzOncoming(t, 0.3, 128);
        return s;
      },
    },
    {
      name: "Country bend", category: "country-roads", road: "bend", tint: null,
      win: [3.2, 5.2], max: 6.8, phases: { potential: [1.7, 3.2] },
      hazard: "An oncoming vehicle cuts the bend across the centre line into your path.",
      clues: ["The bend hides oncoming traffic", "Hedges crowd the road edge", "The oncoming line crosses the centre"],
      response: "Slow on entry so you can stay in your own space if it cuts in.",
      tip: "Meet a blind bend at a speed that keeps you on your side of the line.",
      objs: t => {
        const k = Math.min(1, Math.max(0, (t - 3.2) / 1.6));
        return hzOncoming(t, 1.2, 118 + 46 * k, { color: "#454550" }) + hzSign(312, 260, "#c1272d");
      },
    },
    {
      name: "Bus pulling out", category: "buses", road: "straight", tint: null,
      win: [3.0, 5.2], max: 6.8, phases: { potential: [0.6, 3.0] },
      hazard: "A bus at a stop indicates and pulls out into your path.",
      clues: ["The bus is at a stop with a queue beside it", "An indicator starts to flash", "The gap between you and the bus closes"],
      response: "Ease off and give way; do not undertake the bus as it moves off.",
      tip: "An indicating bus is a moving wall — expect pedestrians near it too.",
      objs: t => {
        const k = Math.min(1, Math.max(0, (t - 3.4) / 1.6));
        let s = hzBusStop(hzY(t, 1.4)) + hzBus(242 - 34 * k, hzY(t, 1.4) + 8, { indicate: t >= 3.0, t });
        s += hzPerson(296, hzY(t, 1.4) + 110);
        return s;
      },
    },
    {
      name: "Delivery van door", category: "delivery-vehicles", road: "residential", tint: null,
      win: [3.1, 5.3], max: 6.8, phases: { potential: [1.6, 3.1] },
      hazard: "A delivery driver steps out from behind their parked van into the road.",
      clues: ["A van stands with its rear doors open", "Parcels wait on the pavement", "The driver cannot see you from behind it"],
      response: "Slow to walking pace and be ready to stop; leave the door zone space.",
      tip: "An open van door means someone is working around it — expect a sudden step-out.",
      objs: t => {
        let s = hzDelivery(230, hzY(t, 1.6));
        if (t >= 3.8) s += hzPerson(262 - 42 * (t - 3.8), hzY(t, 1.6) + 52);
        return s;
      },
    },
    {
      name: "Hidden driveway", category: "concealed", road: "rural", tint: null,
      win: [3.0, 5.4], max: 6.8, phases: { potential: [0.5, 3.0] },
      hazard: "A vehicle reverses out of a concealed driveway through a gap in the hedge.",
      clues: ["A gap in the hedge suggests an entrance", "Nothing seems to move at first", "The reversing path crosses your lane"],
      response: "Cover the brake as you pass gaps you cannot see into; be ready to stop.",
      tip: "A gap you cannot see through is a junction you cannot predict — slow for it.",
      objs: t => {
        let s = hzRR(300, hzY(t, 1.4), 60, 60, "#1a2016", 0) + hzRR(296, hzY(t, 1.4) + 22, 64, 16, "#2b2b33", 2);
        const k = Math.min(1, Math.max(0, (t - 3.2) / 1.7));
        if (t >= 3.2) s += hzCarAhead(312 - 84 * k, hzY(t, 1.4) + 22 + 26 * k, true);
        return s;
      },
    },
    {
      name: "Ice-cream van", category: "children", road: "residential", tint: null,
      win: [3.2, 5.6], max: 7.2, phases: { potential: [0.7, 3.2] },
      hazard: "Children run out from behind a parked ice-cream van.",
      clues: ["An ice-cream van attracts children", "Queued figures wait on the pavement", "The van hides the space behind it"],
      response: "Drop your speed well before the van and cover the brake.",
      tip: "Where children gather, the next move is always unseen — slow before you arrive.",
      objs: t => {
        let s = hzIceCream(234, hzY(t, 1.6));
        s += hzPerson(298, hzY(t, 1.6) - 40) + hzChild(312, hzY(t, 1.6) - 22);
        if (t >= 4.1) s += hzChild(286 - 74 * (t - 4.1), hzY(t, 1.6) + 6);
        if (t >= 4.5) s += hzChild(302 - 82 * (t - 4.5), hzY(t, 1.6) + 22);
        return s;
      },
    },
    {
      name: "Horse rider on the bend", category: "country-roads", road: "bend", tint: null,
      win: [3.0, 5.2], max: 6.6, phases: { potential: [1.5, 3.0] },
      hazard: "A horse rider appears around the bend, the horse spooking toward your lane.",
      clues: ["A rider appears where you cannot see far", "The horse's line drifts toward the centre", "No passing room on the bend"],
      response: "Slow to a walking pace well back, pass wide and quietly only when safe.",
      tip: "Horses react to noise and closeness — slow early and give a horse's width of room.",
      objs: t => {
        const k = Math.min(1, Math.max(0, (t - 3.0) / 1.7));
        return hzHorse(246 - 34 * k, hzY(t, 1.6)) + hzSign(300, 220, "#c1272d");
      },
    },
    {
      name: "Dog walker", category: "animals", road: "residential", tint: null,
      win: [3.0, 5.4], max: 6.8, phases: { potential: [1.5, 3.0] },
      hazard: "A dog on a long lead runs across the road ahead of its walker.",
      clues: ["A long lead crosses the pavement edge", "The walker is distracted", "The dog's attention is on the other side"],
      response: "Ease off and be ready to stop; never sound the horn at animals near you.",
      tip: "A long lead is a tripwire across your path — treat it as a red light.",
      objs: t => {
        const k = Math.min(1, Math.max(0, (t - 3.2) / 1.8));
        let s = hzPerson(300, hzY(t, 1.4)) + hzCat(60, hzY(t, 1.4) + 40);
        s += hzLead(296, hzY(t, 1.4) + 6, 300 - 226 * k, hzY(t, 1.4) + 26);
        s += hzDog(300 - 232 * k, hzY(t, 1.4) + 28);
        return s;
      },
    },
    {
      name: "Residential multiple choice", category: "multiple-hazards", road: "residential", tint: null,
      multi: true, distractorScene: true,
      win: [3.0, 5.4], max: 7.0, phases: { potential: [1.5, 3.0] },
      hazard: "The parked 4x4's reverse lights come on and it backs out of its space into your path.",
      clues: ["Reverse lights appear on the parked 4x4", "It sits at an angle to the kerb", "Its driver cannot see you yet"],
      response: "Hold back and give it room; wait until the driver can see you before passing.",
      tip: "Reverse lights on a parked car are a moving hazard — treat them as a brake light.",
      decoys: [
        "A ball rests on the pavement — nothing follows it this time.",
        "A pedestrian with a pushchair waits at the corner and stays put.",
        "A cat sits on a wall and watches; it never moves.",
      ],
      objs: t => {
        let s = hzParkedAt(222, hzY(t, 2.0), 40, 82);
        const k = Math.min(1, Math.max(0, (t - 3.2) / 1.8));
        if (t >= 3.0) s += hzC(230, hzY(t, 2.0) + 78, 4, "#c1272d") + hzC(254, hzY(t, 2.0) + 78, 4, "#c1272d");
        s += hzRR(222 - 62 * k, hzY(t, 2.0) + 12 * k, 40, 82, "#33333c", 6) + hzRR(226 - 62 * k, hzY(t, 2.0) + 20 + 12 * k, 32, 18, "#26262e", 3);
        s += hzBall(296, hzY(t, 2.0) - 90) + hzCat(52, hzY(t, 2.0) - 40);
        s += hzPerson(306, hzY(t, 2.0) + 130) + hzRR(296, hzY(t, 2.0) + 142, 22, 26, "#8b8b93", 5);
        return s;
      },
    },
    {
      name: "Town centre multiple choice", category: "multiple-hazards", road: "straight", tint: null,
      multi: true,
      win: [3.1, 5.5], max: 7.0, phases: { potential: [1.6, 3.1] },
      hazard: "The cyclist between the queued vehicles swings out into your lane without checking.",
      clues: ["A cyclist filters between the queue", "Their line shifts toward you", "The gap they aim for is closing"],
      response: "Ease off and hold your line; let them choose their space before you move.",
      tip: "A filtering rider picks gaps you cannot see — predict the swing, not the speed.",
      decoys: [
        "A bus stands at the stop with its doors open; nobody steps out.",
        "A pedestrian on a phone stands at the kerb edge but never enters the road.",
      ],
      objs: t => {
        let s = hzBusStop(hzY(t, 1.5)) + hzBus(238, hzY(t, 1.5) - 130, {});
        s += hzCarAhead(128, hzY(t, 1.2), false) + hzCarAhead(238, hzY(t, 1.4), false);
        const k = Math.min(1, Math.max(0, (t - 3.1) / 1.7));
        s += hzCyclist(196 - 58 * k, hzY(t, 1.5) + 40);
        s += hzPhone(298, hzY(t, 1.5) + 150);
        return s;
      },
    },
    {
      name: "Junction multiple choice", category: "multiple-hazards", road: "residential", tint: null,
      multi: true,
      win: [3.0, 5.4], max: 7.0, phases: { potential: [1.5, 3.0] },
      hazard: "The car at the right-hand side road noses out past its give-way line into your path.",
      clues: ["Two vehicles wait at side roads", "The right-hand car creeps forward", "Its front wheels cross the give-way line"],
      response: "Cover the brake as soon as it creeps; be ready to stop in your own lane.",
      tip: "With two junctions, judge intent by wheels and creep — that beats the indicator.",
      decoys: [
        "A van waits at the left junction and stays there; it never moves.",
        "A pedestrian crosses behind a parked van further ahead and clears your path.",
      ],
      objs: t => {
        let s = hzJunctionSide(hzY(t, 1.2), "right") + hzJunctionSide(hzY(t, 1.2) + 150, "left");
        const k = Math.min(1, Math.max(0, (t - 3.0) / 1.8));
        s += hzVan(66, hzY(t, 1.2) + 168);
        s += hzCarAhead(238 + 44 * k, hzY(t, 1.2) + 26 - 30 * k, t > 3.4 && Math.floor(t * 4) % 2 === 0);
        s += hzParkedAt(224, hzY(t, 1.2) - 90, 34, 62) + hzPerson(300 - 56 * Math.min(1, Math.max(0, (t - 2.6) / 1.6)), hzY(t, 1.2) - 66);
        return s;
      },
    },
    {
      name: "Movement behind a van", category: "concealed", road: "residential", tint: null,
      win: [4.0, 6.2], max: 8.0, phases: { potential: [1.4, 4.0] },
      hazard: "A pedestrian emerges from behind a parked van long after the first glimpse of movement beside it.",
      clues: ["A shadow moves beside the parked van", "The van hides the whole footway", "Nothing steps out at first"],
      response: "Hold your speed back while the van hides the view; be ready to stop when the space opens.",
      tip: "A glimpse behind a van is the clue — the step-out comes when you are alongside.",
      objs: t => {
        let s = hzVan(230, hzY(t, 2.2));
        if (t >= 1.4 && t < 4.0) s += hzRR(262, hzY(t, 2.2) + 30 + 6 * Math.sin(t * 5), 8, 26, "rgba(200,200,212,0.55)", 3);
        if (t >= 4.0) s += hzPerson(272 - 46 * (t - 4.0), hzY(t, 2.2) + 30);
        return s;
      },
    },
    {
      name: "Lights change at the crossing", category: "pedestrians", road: "straight", tint: null,
      win: [3.2, 5.6], max: 7.2, phases: { potential: [1.2, 3.2] },
      hazard: "The signals go green-amber-red and a waiting pedestrian steps onto the crossing as your lights turn red.",
      clues: ["The signals sit at green with a person waiting", "Amber gives no extra time to accelerate", "Their attention is on the signal, not you"],
      response: "Plan to stop as the lights change; never race an amber to beat the red.",
      tip: "A pedestrian watches the signal, not you — assume they move the moment it changes.",
      objs: t => {
        const phase = t < 2.6 ? "green" : t < 3.2 ? "amber" : "red";
        let s = hzLights(312, hzY(t, 1.6), phase) + hzCrosswalk(hzY(t, 2.2));
        s += hzPerson(286 - (t >= 3.2 ? 56 * (t - 3.2) : 0), hzY(t, 2.2) + 10);
        return s;
      },
    },
    {
      name: "Nose at the hedge gap", category: "junctions", road: "rural", tint: null,
      win: [3.6, 5.8], max: 7.4, phases: { potential: [1.6, 3.6] },
      hazard: "A vehicle noses out through a hedge gap where only its front bumper is visible before it enters your path.",
      clues: ["A gap in the hedge hides the junction", "Only a sliver of the vehicle shows", "No give-way line is visible from here"],
      response: "Cover the brake before the gap and be ready for the nose to appear in your lane.",
      tip: "A visible sliver of a car means a whole driver who cannot see you — slow for the gap.",
      objs: t => {
        let s = hzHedge(286, hzY(t, 1.6), 68, 46) + hzRR(276, hzY(t, 1.6) + 30, 14, 20, "#232a20", 4);
        if (t >= 1.6) s += hzRR(268, hzY(t, 1.6) + 32, 22, 16, "#454550", 3);
        const k = Math.min(1, Math.max(0, (t - 3.6) / 1.8));
        if (t >= 3.6) s += hzCarAhead(288 - 96 * k, hzY(t, 1.6) + 30 - 26 * k, false);
        return s;
      },
    },
    {
      name: "Heavy rain spray", category: "rain", road: "straight", tint: "rain",
      win: [3.2, 5.6], max: 7.2, phases: { potential: [1.2, 3.2] },
      hazard: "A slow vehicle hidden in spray from the lorry ahead brakes hard as the spray clears.",
      clues: ["Spray from the lorry hides the lane ahead", "Your wipers cannot keep the screen clear", "Speed feels fine but grip is not"],
      response: "Drop back out of the spray and double your gap before you need to brake.",
      tip: "If you cannot see the vehicle ahead's tyres, you cannot see its brake lights.",
      objs: t => {
        const y = hzY(t, 2.4);
        let s = hzRR(152, y - 130, 58, 96, "#4d4d58", 6) + hzSpray(180, y - 46);
        if (t >= 2.6) s += hzSpray(180, y - 46) + hzCarAhead(180, y - 40, t > 3.6 && Math.floor(t * 4) % 2 === 0);
        return s;
      },
    },
    {
      name: "Oncoming glare at night", category: "darkness", road: "straight", tint: "dark",
      win: [3.4, 5.8], max: 7.4, phases: { potential: [1.4, 3.4] },
      hazard: "An unlit cyclist becomes visible only as the oncoming vehicle's glare passes, already close to your path.",
      clues: ["Oncoming headlights fill the mirrors and screen", "The verge disappears in the glare", "A faint shape keeps pace at the kerb"],
      response: "Ease off while the glare lasts and hold your line until you can see the verge again.",
      tip: "In glare you lose the edges of the road — slow before the dazzle, not during it.",
      objs: t => {
        let s = hzGlare(118, hzY(t, 1.8) - 60) + hzOncoming(t, 1.0, 122);
        const k = Math.min(1, Math.max(0, (t - 3.4) / 1.8));
        s += hzCyclist(248 - 36 * k, hzY(t, 1.8) + 20);
        return s;
      },
    },
    {
      name: "Mini roundabout", category: "roundabouts", road: "roundabout", tint: null,
      multi: true,
      win: [3.2, 5.6], max: 7.2, phases: { potential: [1.2, 3.2] },
      hazard: "The car on your right drives straight across the mini-roundabout into your path without looking.",
      clues: ["Three vehicles approach the mini-roundabout", "The right-hand car keeps rolling", "Its speed never matches the give-way"],
      response: "Cover the brake on approach and hold back until the circulating space is yours.",
      tip: "At a mini-roundabout, judge who is rolling — motion beats indicators every time.",
      decoys: [
        "A van approaches from the left and stops correctly at the give-way line.",
        "A cyclist circles the roundabout behind you and exits before you arrive.",
      ],
      objs: t => {
        let s = hzC(180, 150, 30, "#17171c") + hzRing(180, 150, 30, "rgba(255,255,255,.4)", 3) + hzRR(177, 138, 6, 24, "rgba(255,255,255,.3)", 2);
        s += hzVan(66, 208) + hzCyclist(150, 118);
        const k = Math.min(1, Math.max(0, (t - 3.2) / 1.8));
        s += hzCarAhead(262 - 108 * k, 120 + 40 * k, t > 3.6);
        return s;
      },
    },
    {
      name: "Ball on the pavement", category: "multiple-hazards", road: "residential", tint: null,
      multi: true, distractorScene: true,
      win: [3.0, 5.4], max: 7.0, phases: { potential: [1.5, 3.0] },
      hazard: "A parked 4x4's reverse lights come on and it backs out while everything else on screen stays still.",
      clues: ["A ball sits on the pavement edge", "A dog walker pauses on the kerb", "Reverse lights glow on the parked 4x4"],
      response: "Read all three, act on the moving one: hold back for the 4x4 and cover the brake.",
      tip: "Movement decides the hazard — a still ball and a held dog are scenery until they change.",
      decoys: [
        "A ball rests on the pavement and nobody chases it.",
        "A dog on a lead sniffs the kerb and never steps into the road.",
      ],
      objs: t => {
        let s = hzBall(292, hzY(t, 1.8) - 70) + hzPerson(62, hzY(t, 1.8) + 60) + hzDog(84, hzY(t, 1.8) + 66) + hzLead(70, hzY(t, 1.8) + 56, 82, hzY(t, 1.8) + 64);
        s += hzParkedAt(222, hzY(t, 1.8), 40, 82);
        const k = Math.min(1, Math.max(0, (t - 3.0) / 1.8));
        if (t >= 3.0) s += hzC(230, hzY(t, 1.8) + 78, 4, "#c1272d") + hzC(254, hzY(t, 1.8) + 78, 4, "#c1272d");
        s += hzRR(222 - 62 * k, hzY(t, 1.8) + 12 * k, 40, 82, "#33333c", 6) + hzRR(226 - 62 * k, hzY(t, 1.8) + 20 + 12 * k, 32, 18, "#26262e", 3);
        return s;
      },
    },
    {
      name: "School street — ball rolls out", category: "multiple-hazards", road: "residential", tint: null,
      multi: true,
      win: [4.6, 6.8], max: 8.4, phases: { potential: [2.2, 4.6] },
      hazard: "A ball rolls into the road late and a child runs after it — everything else stays harmless the whole scene.",
      clues: ["A ball appears at the kerb late on", "Children wait near the school gate", "Parked vehicles hide the footway"],
      response: "Hold a speed that lets you stop for any one of them; react only when something enters your path.",
      tip: "The discipline is waiting: a watched scene with no movement is a safe scene.",
      decoys: [
        "A dog on a lead walks at heel past the school and never steps off the kerb.",
        "A parked van has its rear doors open, but nobody moves around it.",
        "Children stand inside the school gate and stay there.",
      ],
      objs: t => {
        let s = hzParked(hzY(t, 2.4)) + hzDelivery(232, hzY(t, 2.4) - 130);
        s += hzPerson(64, hzY(t, 2.4) + 30) + hzDog(88, hzY(t, 2.4) + 36) + hzLead(72, hzY(t, 2.4) + 22, 86, hzY(t, 2.4) + 34);
        s += hzChild(300, hzY(t, 2.4) - 210) + hzChild(316, hzY(t, 2.4) - 194);
        if (t >= 4.2) s += hzBall(300 - 40 * (t - 4.2), hzY(t, 2.4) + 20);
        if (t >= 4.6) s += hzChild(306 - 70 * (t - 4.6), hzY(t, 2.4) + 18);
        return s;
      },
    },
    {
      name: "Bus stop patience", category: "pedestrians", road: "straight", tint: null,
      multi: true,
      win: [4.4, 6.6], max: 8.2, phases: { potential: [1.8, 4.4] },
      hazard: "A pedestrian steps off the kerb late to cross behind the stopped bus — all the early scenes stay harmless.",
      clues: ["A queue waits at the bus stop", "A phone user stands at the kerb edge", "The bus hides the crossing point"],
      response: "Keep a walking-pace approach past the bus and cover the brake for a hidden crossing.",
      tip: "The dangerous move is always the one you cannot see — plan for it before it happens.",
      decoys: [
        "A phone user stands at the kerb and never looks up.",
        "The queue at the bus stop boards one at a time and stays on the kerb.",
      ],
      objs: t => {
        let s = hzBusStop(hzY(t, 2.6)) + hzBus(242, hzY(t, 2.6) + 8, {});
        s += hzPhone(58, hzY(t, 2.6) + 130) + hzPerson(300, hzY(t, 2.6) - 80) + hzPerson(318, hzY(t, 2.6) - 60);
        if (t >= 4.4) s += hzPerson(306 - 64 * (t - 4.4), hzY(t, 2.6) + 48);
        return s;
      },
    },
    {
      name: "Meeting on the country lane", category: "multiple-hazards", road: "bend", tint: "wet",
      multi: true,
      win: [3.2, 5.6], max: 7.4, phases: { potential: [1.2, 3.2] },
      hazard: "The horse rider's mount shies toward your lane as you pass a cyclist and an oncoming tractor.",
      clues: ["A horse rider approaches on the narrow lane", "A cyclist rides ahead of you", "An oncoming tractor takes the crown of the road"],
      response: "Slow to a walking pace, hold back behind the cyclist, and pass the horse wide and quiet.",
      tip: "On a country lane the order matters: pass the cyclist before you meet the horse, not during.",
      decoys: [
        "The cyclist ahead keeps a steady line and moves left for you.",
        "The oncoming tractor stays on its own side and passes without conflict.",
      ],
      objs: t => {
        let s = hzFence(292, hzY(t, 1.8), 62) + hzCyclist(226, hzY(t, 1.8) + 70);
        s += hzOncoming(t, 0.8, 120, { color: "#4a5a3a" });
        const k = Math.min(1, Math.max(0, (t - 3.2) / 1.8));
        s += hzHorse(252 - 40 * k, hzY(t, 1.8) - 60);
        return s;
      },
    },
  ];

  /* ---------------- deterministic display copy ---------------- */
  /**
   * Phase boundaries of a scenario, mirroring Core.hazardPhaseAt semantics:
   * background before potential[0], potential until win[0], developing across
   * the window, critical from win[1] to the end of the scene.
   */
  function phaseBounds(sc) {
    const win = (sc && sc.win) || [0, 1];
    const pot = sc && sc.phases && Array.isArray(sc.phases.potential) ? sc.phases.potential : null;
    return {
      potStart: pot ? pot[0] : Math.max(0, win[0] - 1.5),
      winStart: win[0],
      winEnd: win[1],
      end: (sc && sc.max) || win[1],
    };
  }
  /** Local mirror of Core.hazardPhaseAt for text generation (tests may run
   *  this file without js/core.js). */
  function phaseAt(sc, t) {
    if (t == null || !(t >= 0)) return null;
    const b = phaseBounds(sc);
    if (t >= b.winEnd) return "critical";
    if (t >= b.winStart) return "developing";
    if (t >= b.potStart) return "potential";
    return "background";
  }
  /** Words for the phase arc the timeline visual draws. */
  function phaseArcText(sc) {
    const b = phaseBounds(sc);
    return `Phase arc: background 0.0s to ${b.potStart.toFixed(1)}s; `
      + `potential ${b.potStart.toFixed(1)}s to ${b.winStart.toFixed(1)}s; `
      + `developing ${b.winStart.toFixed(1)}s to ${b.winEnd.toFixed(1)}s (this is the scoring window); `
      + `critical ${b.winEnd.toFixed(1)}s to ${b.end.toFixed(1)}s.`;
  }

  /**
   * Text equivalent of the timeline visual: the phase arc in words, the
   * developing window, and every click's position and phase. Deterministic —
   * pure function of its inputs.
   */
  function timelineText(sc, analysis, presses) {
    const list = (Array.isArray(presses) ? presses : []).filter((t) => typeof t === "number" && isFinite(t) && t >= 0).sort((a, b) => a - b);
    const winLine = `Developing window: ${analysis.winStart.toFixed(1)}s to ${analysis.winEnd.toFixed(1)}s.`;
    const arcLine = phaseArcText(sc);
    if (!list.length) return `${winLine} ${arcLine} You did not click.`;
    const parts = list.map((t) => {
      const phase = phaseAt(sc, t);
      if (t < analysis.winStart - 0.35) {
        const note = phase === "background" ? "background phase — a false positive"
          : phase === "potential" ? "potential phase — early anticipation"
          : "";
        return `${t.toFixed(1)}s (before the hazard developed)${note ? ` — ${note}` : ""}`;
      }
      if (t > analysis.winEnd) return `${t.toFixed(1)}s (after the hazard had finished developing) — ${phase || "critical"} phase`;
      return `${t.toFixed(1)}s${phase ? ` (${phase} phase)` : ""}`;
    });
    const first = list.find((t) => t >= analysis.winStart - 0.35);
    const useful = first == null ? "" : ` First useful click: ${first.toFixed(1)}s.`;
    return `${winLine} ${arcLine} You clicked at ${parts.join(", ")}.${useful}`;
  }

  /**
   * Post-scenario explanation in phase framing, built from Core.hazardTiming
   * output. Deterministic. Example voice: "You noticed the cyclist while they
   * were still only a potential hazard. The hazard became developing when the
   * parked van began blocking your view and the cyclist moved toward your lane."
   */
  function phaseNarrative(sc, timing) {
    const b = phaseBounds(sc);
    const name = (sc && sc.name ? sc.name.toLowerCase() : "the hazard");
    const hazard = sc && sc.hazard ? sc.hazard.charAt(0).toLowerCase() + sc.hazard.slice(1) : "";
    const became = `The situation became developing at ${b.winStart.toFixed(1)}s — ${hazard}`;
    const out = [];
    const phase = timing && timing.firstObservationPhase;
    if (timing && timing.firstObservation == null) {
      out.push(`You did not click. The early clues were visible from ${b.potStart.toFixed(1)}s, well before anything threatened your path.`);
      out.push(became);
    } else if (phase === "background") {
      out.push(`Your first click came in the background phase — nothing was directed at your path yet, so it counts as a false positive rather than anticipation.`);
      out.push(became);
    } else if (phase === "potential") {
      out.push(`You noticed ${name} while it was still only a potential hazard — the clues were visible but nothing was directed at your path yet.`);
      out.push(became);
    } else if (phase === "developing") {
      out.push(`You first reacted as ${name} was already developing — inside the window, but the clues were on screen from ${b.potStart.toFixed(1)}s.`);
    } else {
      out.push(`Your first reaction came in the critical phase, when ${name} was already fully under way.`);
      out.push(became);
    }
    if (timing && timing.firstObservation != null && timing.firstObservationPhase === "potential") {
      out.push(`Clicking at ${timing.firstObservation.toFixed(1)}s was correct anticipation from the potential phase — anything before the clues appeared would be a false positive.`);
    }
    if (timing && timing.falsePositives > 0) {
      out.push(`${timing.falsePositives} of your click${timing.falsePositives > 1 ? "s came" : " came"} in the background phase — false positives, not early anticipation.`);
    }
    if (timing && timing.repeatedClicks > 1) {
      out.push(`You clicked ${timing.repeatedClicks} times; trained perception is one deliberate response to the developing situation.`);
    }
    return out;
  }

  /* ---------------- skill categories (display copy) ---------------- */
  const CATEGORY_LABELS = {
    "children": "Child hazards", "parked-vehicles": "Parked-vehicle hazards",
    "traffic": "Traffic hazards", "animals": "Animal hazards",
    "pedestrians": "Pedestrian hazards", "cyclists": "Cyclist hazards",
    "motorcyclists": "Motorcyclist hazards", "junctions": "Junction hazards",
    "roundabouts": "Roundabout hazards", "merging": "Merging hazards",
    "concealed": "Concealed hazards", "roadworks": "Roadworks hazards",
    "emergency": "Emergency-vehicle hazards", "rain": "Rain hazards",
    "darkness": "Darkness hazards", "country-roads": "Country-road hazards",
    "buses": "Bus hazards", "delivery-vehicles": "Delivery-vehicle hazards",
    "multiple-hazards": "Multiple-hazard scenes",
  };
  function categoryLabel(cat) { return CATEGORY_LABELS[cat] || `${String(cat).replace(/-/g, " ")} hazards`; }

  /** "Concealed hazards — detected late in 3 of 4" for one skill row. */
  function skillLine(row) {
    const label = categoryLabel(row.category);
    const n = row.attempts || 0;
    if (!n) return `${label} — no attempts yet`;
    const lateMissed = (row.late || 0) + (row.missed || 0);
    if (lateMissed === 0) return `${label} — read early in ${n} of ${n}`;
    if ((row.missed || 0) > (row.late || 0)) return `${label} — missed in ${row.missed} of ${n}`;
    return `${label} — detected late in ${row.late} of ${n}`;
  }

  /**
   * 1-2 coaching lines plus one concrete recommendation, in the tone of
   * nextSteps(). Deterministic: weakest category first, honest wording.
   */
  function categoryCoaching(skillRows, bank) {
    const rows = (Array.isArray(skillRows) ? skillRows : []).filter((r) => r && r.attempts);
    if (!rows.length) return { lines: [], recommendation: "" };
    const weak = rows[0];
    const struggling = weak.attempts >= 2 && ((weak.late || 0) + (weak.missed || 0)) * 2 >= weak.attempts;
    const lines = [];
    if (struggling) {
      const how = (weak.missed || 0) > (weak.late || 0) ? "go unseen" : "are consistently detected late";
      lines.push(`Your hazard recognition is strong overall, but ${categoryLabel(weak.category).toLowerCase()} ${how}.`);
    } else {
      lines.push("Your recognition is consistent across the categories you trained — keep mixing them so no single pattern goes stale.");
    }
    const pool = (Array.isArray(bank) ? bank : []).filter((s) => s.category === weak.category);
    const n = Math.max(1, Math.min(3, pool.length || 1));
    const mins = Math.max(1, Math.round(n * 1.3));
    const label = categoryLabel(weak.category).toLowerCase();
    const catAdj = label.endsWith(" hazards") ? `${label.slice(0, -" hazards".length)}-hazard`
      : label.replace(/ (scenarios?|scenes)$/, "");
    return {
      lines,
      recommendation: `${n} ${catAdj} scenario${n > 1 ? "s" : ""} · ~${mins} min`,
    };
  }

  /** Anticipation-class counts plus late-recognition and clicking counts. */
  function summaryCounts(analyses) {
    const rows = (Array.isArray(analyses) ? analyses : []).filter(Boolean);
    const counts = { anticipatory: 0, reactive: 0, overEager: 0, none: 0, lateRecognition: 0, excessive: 0 };
    for (const a of rows) {
      if (a.anticipation === "anticipatory") counts.anticipatory++;
      else if (a.anticipation === "reactive") counts.reactive++;
      else if (a.anticipation === "over-eager") counts.overEager++;
      else counts.none++;
      if (a.scoredPress != null && a.scoredPress > a.winEnd) counts.lateRecognition++;
      if (a.excessive) counts.excessive++;
    }
    return counts;
  }

  /** 1-2 specific next-step lines for the end-of-run summary. Deterministic.
   *  `skillRows` (optional) adds category-aware coaching on top of the
   *  timing-based lines. */
  function nextSteps(summary, counts, skillRows) {
    if (!summary || summary.total === 0) return ["Start a session to get training feedback on your hazard timing."];
    const out = [];
    const rows = (Array.isArray(skillRows) ? skillRows : []).filter((r) => r && r.attempts);
    const weak = rows[0];
    if (weak && weak.attempts >= 2 && ((weak.late || 0) + (weak.missed || 0)) * 2 >= weak.attempts) {
      const how = (weak.missed || 0) > (weak.late || 0) ? "go unseen" : "are consistently detected late";
      out.push(`Your hazard recognition is strong overall, but ${categoryLabel(weak.category).toLowerCase()} ${how}.`);
    }
    if (counts && counts.overEager >= 2 && out.length < 2) {
      out.push(`You clicked before anything was developing in ${counts.overEager} scenes — wait for a movement that threatens your path before reacting.`);
    }
    if (counts && counts.lateRecognition > 0) {
      out.push(`You clicked only after the hazard had finished developing in ${counts.lateRecognition} scene${counts.lateRecognition > 1 ? "s" : ""} — scan one step further ahead, where the conflict will be.`);
    }
    if (summary.missed > 0 && out.length < 2) {
      out.push(`You missed ${summary.missed} hazard${summary.missed > 1 ? "s" : ""} entirely — sweep the road edges and the space around parked vehicles before deciding it is clear.`);
    }
    if (counts && counts.excessive > 0 && out.length < 2) {
      out.push(`You clicked more than five times in ${counts.excessive} scene${counts.excessive > 1 ? "s" : ""} — practise judging the single moment a hazard starts instead of covering every possibility.`);
    }
    if (out.length < 2) {
      out.push(summary.verdict === "sharp"
        ? "Your recognition is sharp — hold it by training in rain, darkness and cluttered scenes where the clues are weaker."
        : "Focus one step ahead: read where each road user could move next, not where they are now.");
    }
    return out.slice(0, 2);
  }

  const RoadReadyHazardScenarios = {
    HZ, RUN_SIZE, scenarios: HZ_SCENARIOS,
    buildScene: hzScene, y: hzY,
    timelineText, summaryCounts, nextSteps,
    phaseBounds, phaseAt, phaseArcText, phaseNarrative,
    CATEGORY_LABELS, categoryLabel, skillLine, categoryCoaching,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyHazardScenarios;
  else root.RoadReadyHazardScenarios = RoadReadyHazardScenarios;
})(typeof globalThis !== "undefined" ? globalThis : this);
