/* Road sign SVG library — simplified but shape/color-accurate renderings.
   Each entry: name, family, meaning, svg (100x100 viewBox). */
"use strict";

const YEL = "#f2b800";      // standard warning yellow
const RED = "#c1272d";      // standard regulatory red
const GRN = "#1a9134";      // guide green
const BLU = "#1554a4";      // service blue
const YGR = "#c9e23a";      // fluorescent yellow-green (school)

const FONT = 'Arial, "Segoe UI", sans-serif';

function diamond(fill, inner) {
  return `<polygon points="50,4 96,50 50,96 4,50" fill="${fill}" stroke="#111" stroke-width="3.5"/>${inner}`;
}
function txt(x, y, s, size, fill, extra) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="900" font-size="${size}" fill="${fill}" text-anchor="middle" ${extra || ""}>${s}</text>`;
}
// simple walking person pictogram
function person(cx, cy, s, fill) {
  s = s || 1;
  return `<g stroke="${fill || "#111"}" stroke-width="${5 * s}" stroke-linecap="round" fill="${fill || "#111"}">
    <circle cx="${cx - 2 * s}" cy="${cy - 26 * s}" r="${6 * s}" stroke="none"/>
    <line x1="${cx - 2 * s}" y1="${cy - 19 * s}" x2="${cx + 2 * s}" y2="${cy + 2 * s}"/>
    <line x1="${cx + 2 * s}" y1="${cy + 2 * s}" x2="${cx + 13 * s}" y2="${cy + 20 * s}"/>
    <line x1="${cx + 2 * s}" y1="${cy + 2 * s}" x2="${cx - 9 * s}" y2="${cy + 21 * s}"/>
    <line x1="${cx - 1 * s}" y1="${cy - 12 * s}" x2="${cx + 11 * s}" y2="${cy - 4 * s}"/>
    <line x1="${cx - 1 * s}" y1="${cy - 12 * s}" x2="${cx - 11 * s}" y2="${cy - 6 * s}"/>
  </g>`;
}
// vertical thick arrow (path up or down)
function arrow(x, y, len, dir, color, w) {
  const hx = x, hy = y + (dir === "up" ? -len : len);
  const tip = hy + (dir === "up" ? -14 : 14);
  const b1 = hy + (dir === "up" ? 6 : -6);
  return `<g fill="${color}" stroke="none">
    <rect x="${x - w / 2}" y="${Math.min(y, hy)}" width="${w}" height="${Math.abs(len)}"/>
    <polygon points="${hx - 11},${b1} ${hx + 11},${b1} ${hx},${tip}"/>
  </g>`;
}

const SIGNS = {
  stop: {
    name: "Stop", family: "Regulatory — octagon",
    meaning: "Come to a COMPLETE stop at the stop line, crosswalk, or before the intersection if there is no line. Yield to pedestrians and cross traffic. Go only when it is safe.",
    svg: `<polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill="${RED}" stroke="#fff" stroke-width="4"/>${txt(50, 56, "STOP", 25, "#fff")}`
  },
  yield: {
    name: "Yield", family: "Regulatory — inverted triangle",
    meaning: "Slow down and give the right of way to traffic and pedestrians ahead. Stop if necessary; only proceed when you won't interfere with cross traffic.",
    svg: `<polygon points="6,8 94,8 50,92" fill="#fff" stroke="${RED}" stroke-width="9"/>${txt(50, 32, "YIELD", 15, RED)}`
  },
  doNotEnter: {
    name: "Do Not Enter", family: "Regulatory",
    meaning: "Do not enter this road or ramp. Used for one-way streets, exit ramps, and restricted roads — entering means driving against traffic.",
    svg: `<circle cx="50" cy="50" r="46" fill="${RED}" stroke="#fff" stroke-width="4"/><rect x="12" y="41" width="76" height="18" fill="#fff"/>`
  },
  wrongWay: {
    name: "Wrong Way", family: "Regulatory",
    meaning: "You are driving against traffic. Pull over immediately, stop, and turn around. Often paired with DO NOT ENTER signs on freeway ramps.",
    svg: `<rect x="6" y="14" width="88" height="72" rx="5" fill="${RED}"/>${txt(50, 42, "WRONG", 20, "#fff")}${txt(50, 70, "WAY", 20, "#fff")}`
  },
  speedLimit: {
    name: "Speed Limit", family: "Regulatory",
    meaning: "The MAXIMUM legal speed under ideal conditions. In rain, fog, or heavy traffic you must drive slower — the basic speed law always applies.",
    svg: `<rect x="10" y="6" width="80" height="88" rx="7" fill="#fff" stroke="#111" stroke-width="4"/>${txt(50, 28, "SPEED", 13, "#111")}${txt(50, 44, "LIMIT", 13, "#111")}${txt(50, 74, "55", 30, "#111")}`
  },
  oneWay: {
    name: "One Way", family: "Regulatory",
    meaning: "Traffic flows only in the direction of the arrow. Never turn against it.",
    svg: `<rect x="5" y="30" width="90" height="40" rx="4" fill="#111"/>${arrow(50, 62, 24, "up", "#fff", 12)}${txt(50, 24, "ONE WAY", 14, "#111")}`
  },
  noUturn: {
    name: "No U-Turn", family: "Regulatory (prohibition)",
    meaning: "U-turns are prohibited here. Plan an alternate route — go around the block or take legal turns instead.",
    svg: `<rect x="6" y="6" width="88" height="88" rx="8" fill="#fff" stroke="#111" stroke-width="3"/>
      <path d="M35,72 L35,48 A15,15 0 0 1 65,48 L65,72" fill="none" stroke="#111" stroke-width="7"/>
      <polygon points="58,68 72,68 65,80" fill="#111"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="${RED}" stroke-width="8"/>
      <line x1="20" y1="80" x2="80" y2="20" stroke="${RED}" stroke-width="8"/>`
  },
  noLeftTurn: {
    name: "No Left Turn", family: "Regulatory (prohibition)",
    meaning: "Left turns are prohibited at this intersection. Continue and make the turn elsewhere (e.g., three right turns around the block).",
    svg: `<rect x="6" y="6" width="88" height="88" rx="8" fill="#fff" stroke="#111" stroke-width="3"/>
      <line x1="40" y1="75" x2="40" y2="40" stroke="#111" stroke-width="8" stroke-linecap="round"/>
      <polygon points="30,42 50,42 40,26" fill="#111"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="${RED}" stroke-width="8"/>
      <line x1="20" y1="80" x2="80" y2="20" stroke="${RED}" stroke-width="8"/>`
  },
  noParking: {
    name: "No Parking", family: "Regulatory (prohibition)",
    meaning: "You may not park here (stopping briefly to load/unload may be allowed — 'No Stopping' or 'No Standing' signs are stricter).",
    svg: `<rect x="6" y="6" width="88" height="88" rx="8" fill="#fff" stroke="#111" stroke-width="3"/>
      ${txt(50, 62, "P", 44, RED)}
      <circle cx="50" cy="50" r="42" fill="none" stroke="${RED}" stroke-width="8"/>
      <line x1="20" y1="80" x2="80" y2="20" stroke="${RED}" stroke-width="8"/>`
  },
  keepRight: {
    name: "Keep Right", family: "Regulatory",
    meaning: "Keep to the right of the island, median, or obstruction ahead.",
    svg: `<rect x="6" y="6" width="88" height="88" rx="8" fill="#fff" stroke="#111" stroke-width="4"/>
      <line x1="50" y1="88" x2="50" y2="46" stroke="#111" stroke-width="8" stroke-linecap="round"/>
      <polygon points="38,48 62,48 50,26" fill="#111"/>`
  },
  noPassingZone: {
    name: "No Passing Zone (pennant)", family: "Warning — pennant",
    meaning: "The pennant marks the START of a no-passing zone on the left side of the road. Do not pass another vehicle from here until the zone ends.",
    svg: `<polygon points="4,10 88,42 4,74" fill="${YEL}" stroke="#111" stroke-width="3"/>${txt(30, 40, "NO", 11, "#111")}${txt(30, 54, "PASSING", 8, "#111")}${txt(30, 66, "ZONE", 9, "#111")}`
  },
  railCrossing: {
    name: "Railroad Crossing Ahead", family: "Warning — round",
    meaning: "You are approaching a railroad crossing. Slow down, look and listen for trains, and be prepared to stop. Never stop on the tracks.",
    svg: `<circle cx="50" cy="50" r="46" fill="${YEL}" stroke="#111" stroke-width="4"/>
      <text x="27" y="36" font-family="${FONT}" font-weight="900" font-size="26" fill="#111">R</text>
      <text x="56" y="36" font-family="${FONT}" font-weight="900" font-size="26" fill="#111">R</text>
      <line x1="18" y1="30" x2="82" y2="70" stroke="#111" stroke-width="7"/>
      <line x1="18" y1="70" x2="82" y2="30" stroke="#111" stroke-width="7"/>`
  },
  pedCrossing: {
    name: "Pedestrian Crossing", family: "Warning",
    meaning: "People may be crossing ahead. Slow down, scan the sidewalks, and be ready to stop and yield to pedestrians in the crosswalk.",
    svg: diamond(YEL, person(50, 58, 1.15, "#111"))
  },
  schoolZone: {
    name: "School Zone", family: "Warning — pentagon (school)",
    meaning: "A school crossing area ahead. Slow to the posted school limit, watch for children, and obey crossing guards. Fluorescent yellow-green pentagon = school.",
    svg: `<polygon points="50,4 95,36 78,94 22,94 5,36" fill="${YGR}" stroke="#111" stroke-width="3.5"/>
      ${person(36, 58, 0.9, "#111")}${person(60, 58, 0.9, "#111")}`
  },
  schoolCrossing: {
    name: "School Crossing", family: "Warning — pentagon (school)",
    meaning: "Children cross the road here, often with a crossing guard. Slow down, stop for children in the crosswalk, and never pass another vehicle stopped for the crossing.",
    svg: `<polygon points="50,4 95,36 78,94 22,94 5,36" fill="${YGR}" stroke="#111" stroke-width="3.5"/>
      ${person(36, 52, 0.85, "#111")}${person(60, 52, 0.85, "#111")}
      <line x1="16" y1="72" x2="84" y2="72" stroke="#111" stroke-width="5"/>
      <line x1="16" y1="84" x2="84" y2="84" stroke="#111" stroke-width="5"/>`
  },
  deerCrossing: {
    name: "Animal Crossing (Deer)", family: "Warning",
    meaning: "Wild animals frequently cross here, especially at dawn and dusk. Slow down and stay alert — if one animal crosses, more may follow.",
    svg: diamond(YEL,
      `<g fill="#111" stroke="none">
        <polygon points="18,64 26,50 38,45 50,46 56,36 54,28 58,20 66,22 62,28 66,32 60,34 54,42 62,50 74,46 80,48 74,54 62,56 58,64 66,76 61,78 54,68 46,70 44,80 39,81 38,70 28,72 24,82 19,82 22,68"/>
        <polygon points="56,32 62,24 66,26 60,34"/>
      </g>`)
  },
  slippery: {
    name: "Slippery When Wet", family: "Warning",
    meaning: "The road surface is extra slick when wet (rain, ice, oil). Slow down well before curves and avoid sudden steering or hard braking.",
    svg: diamond(YEL,
      `<g stroke="#111" stroke-width="6" stroke-linecap="round" fill="none">
        <path d="M25,80 Q35,62 30,50"/>
        <path d="M45,82 Q55,64 50,52"/>
        <rect x="40" y="18" width="30" height="16" rx="4" fill="#111" stroke="none"/>
        <rect x="46" y="32" width="18" height="14" rx="3" fill="#111" stroke="none"/>
      </g>`)
  },
  merge: {
    name: "Merging Traffic", family: "Warning",
    meaning: "Traffic is merging into your road or lane ahead. Adjust your speed and space so merging vehicles can enter smoothly — the merge is a shared job.",
    svg: diamond(YEL,
      `<g stroke="#111" stroke-width="9" stroke-linecap="round" fill="none">
        <line x1="46" y1="82" x2="46" y2="34"/>
        <path d="M22,84 Q36,72 42,52"/>
      </g>
      <polygon points="36,36 56,36 46,18" fill="#111"/>
      <polygon points="38,50 50,42 48,58" fill="#111"/>`)
  },
  dividedHighwayBegins: {
    name: "Divided Highway Begins", family: "Warning",
    meaning: "The road ahead is divided by a median. Keep to the RIGHT of the divider — traffic on the other side will be coming toward you.",
    svg: diamond(YEL,
      `<g fill="none" stroke="#111" stroke-width="6" stroke-linecap="round">
        <rect x="55" y="22" width="12" height="52" rx="6"/>
      </g>
      ${arrow(32, 80, 52, "up", "#111", 10)}`)
  },
  twoWayTraffic: {
    name: "Two-Way Traffic", family: "Warning",
    meaning: "You are leaving a one-way road — traffic will come from the opposite direction ahead. Keep right and don't pass unless legal and clear.",
    svg: diamond(YEL,
      `${arrow(35, 80, 52, "up", "#111", 10)}${arrow(65, 20, 52, "down", "#111", 10)}`)
  },
  roundabout: {
    name: "Roundabout Ahead", family: "Warning",
    meaning: "A circular intersection is ahead. Slow down, keep LEFT of the central island, travel counterclockwise, and yield to traffic already circulating.",
    svg: diamond(YEL,
      `<circle cx="50" cy="50" r="24" fill="none" stroke="#111" stroke-width="7"/>
      <polygon points="26,50 44,38 44,62" fill="#111"/>
      <polygon points="74,50 56,62 56,38" fill="#111"/>`)
  },
  hill: {
    name: "Steep Downgrade", family: "Warning",
    meaning: "A steep hill is ahead. Slow down and shift to a LOW gear instead of riding the brakes, which can overheat and fail.",
    svg: diamond(YEL,
      `<line x1="14" y1="76" x2="86" y2="42" stroke="#111" stroke-width="6" stroke-linecap="round"/>
      <g fill="#111"><rect x="50" y="30" width="26" height="14" rx="2"/><rect x="56" y="44" width="14" height="8"/></g>
      <circle cx="55" cy="56" r="4" fill="#111"/><circle cx="68" cy="57.5" r="4" fill="#111"/>`)
  },
  workZone: {
    name: "Road Work Ahead", family: "Warning — orange = construction",
    meaning: "Orange signs mark a temporary work zone. Slow down, increase following distance, obey flaggers, and watch for workers — fines are often doubled.",
    svg: diamond("#f28c1b",
      `<g stroke="#111" stroke-width="6" stroke-linecap="round">
        <circle cx="40" cy="28" r="6" fill="#111" stroke="none"/>
        <line x1="40" y1="36" x2="40" y2="58"/><line x1="40" y1="44" x2="30" y2="56"/><line x1="40" y1="44" x2="52" y2="54"/>
        <line x1="40" y1="58" x2="34" y2="76"/><line x1="40" y1="58" x2="46" y2="76"/>
        <line x1="58" y1="76" x2="58" y2="44"/><rect x="52" y="34" width="12" height="10" fill="#111" stroke="none"/>
      </g>`)
  },
  flagger: {
    name: "Flagger Ahead", family: "Warning — orange = construction",
    meaning: "A flag person is directing traffic ahead. Their instructions override signs and signals — slow down and follow their signals exactly.",
    svg: diamond("#f28c1b",
      `<g stroke="#111" stroke-width="6" stroke-linecap="round">
        <circle cx="38" cy="26" r="6" fill="#111" stroke="none"/>
        <line x1="38" y1="34" x2="38" y2="56"/>
        <line x1="38" y1="40" x2="56" y2="46"/>
        <line x1="38" y1="56" x2="30" y2="76"/><line x1="38" y1="56" x2="46" y2="76"/>
        <line x1="56" y1="46" x2="56" y2="24"/>
      </g>
      <polygon points="58,22 74,26 58,34" fill="${RED}"/>`)
  },
  signalAhead: {
    name: "Signal Ahead", family: "Warning",
    meaning: "A traffic signal is just ahead (often hidden by a curve or hill). Be ready to stop — check your mirror and ease off the gas.",
    svg: diamond(YEL,
      `<rect x="38" y="16" width="24" height="52" rx="6" fill="#111"/>
      <circle cx="50" cy="28" r="6" fill="${RED}"/>
      <circle cx="50" cy="42" r="6" fill="#e8b31a"/>
      <circle cx="50" cy="56" r="6" fill="${GRN}"/>
      <line x1="50" y1="68" x2="50" y2="80" stroke="#111" stroke-width="5"/>`)
  },
  stopAhead: {
    name: "Stop Sign Ahead", family: "Warning",
    meaning: "A stop sign is ahead and may be hard to see. Start slowing now and prepare to come to a complete stop.",
    svg: diamond(YEL,
      `<polygon points="38,26 62,26 74,38 74,62 62,74 38,74 26,62 26,38" fill="${RED}"/>${txt(50, 54, "STOP", 13, "#fff")}`)
  },
  bikeCrossing: {
    name: "Bicycle Crossing", family: "Warning",
    meaning: "Bicyclists cross or share the road ahead. Slow down, check for riders, and give at least 3 feet when passing.",
    svg: diamond(YEL,
      `<g fill="none" stroke="#111" stroke-width="5" stroke-linecap="round">
        <circle cx="32" cy="66" r="12"/><circle cx="68" cy="66" r="12"/>
        <path d="M32,66 L44,44 L60,44 M56,66 L48,44 M44,44 L40,36 M56,36 L60,44"/>
      </g>
      <circle cx="48" cy="32" r="5" fill="#111"/>`)
  },
  hospital: {
    name: "Hospital", family: "Service — blue",
    meaning: "Blue signs mark services for drivers. This one means a hospital is nearby.",
    svg: `<rect x="8" y="8" width="84" height="84" rx="8" fill="${BLU}" stroke="#fff" stroke-width="4"/>${txt(50, 62, "H", 48, "#fff")}`
  },
  chevron: {
    name: "Chevron (sharp curve)", family: "Warning — alignment",
    meaning: "A sharp curve bends in the direction of the chevron (here: right). Slow down BEFORE the curve, keep right, and don't brake mid-curve.",
    svg: `<rect x="24" y="4" width="52" height="92" rx="6" fill="${YEL}" stroke="#111" stroke-width="4"/>
      <g fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M38,28 L58,50 L38,72"/>
        <path d="M52,28 L72,50 L52,72"/>
      </g>`
  },
  deadEnd: {
    name: "Dead End", family: "Warning",
    meaning: "The road ahead ends — it does not connect through. Be ready to turn around; don't wait until the last second to slow.",
    svg: diamond(YEL, `${txt(50, 44, "DEAD", 15, "#111")}${txt(50, 62, "END", 15, "#111")}`)
  },
  softShoulder: {
    name: "Soft Shoulder", family: "Warning",
    meaning: "The roadside is dirt, gravel, or unstable — softer than pavement. If you must pull over, slow down first; don't jerk the wheel on the shoulder.",
    svg: diamond(YEL,
      `<line x1="12" y1="58" x2="88" y2="58" stroke="#111" stroke-width="6" stroke-linecap="round"/>
      <line x1="12" y1="74" x2="88" y2="74" stroke="#111" stroke-width="6" stroke-linecap="round"/>
      <g fill="#111" stroke="none"><rect x="42" y="20" width="28" height="14" rx="3"/><rect x="48" y="34" width="16" height="10"/></g>`)
  },
};

function signSVG(id, size) {
  const s = SIGNS[id];
  if (!s) return "";
  const px = size ? ` width="${size}" height="${size}"` : "";
  return `<svg viewBox="0 0 100 100"${px} role="img" aria-label="${s.name} sign">${s.svg}</svg>`;
}
