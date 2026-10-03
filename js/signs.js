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
    alt: { UK: { name: "Stop", meaning: "Come to a complete stop at the stop line, or before the junction and the crossing if there is no line. Give priority to anyone on the crossing and to traffic approaching from your right. Move off only when it is safe." } },
    svg: `<polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill="${RED}" stroke="#fff" stroke-width="4"/>${txt(50, 56, "STOP", 25, "#fff")}`
  },
  yield: {
    name: "Yield", family: "Regulatory — inverted triangle",
    meaning: "Slow down and give the right of way to traffic and pedestrians ahead. Stop if necessary; only proceed when you won't interfere with cross traffic.",
    alt: { UK: { name: "Give Way", meaning: "Give priority to traffic and people crossing or approaching from your right. You may proceed without stopping, but only where it is safe to do so." } },
    svg: `<polygon points="6,8 94,8 50,92" fill="#fff" stroke="${RED}" stroke-width="9"/>${txt(50, 32, "YIELD", 15, RED)}`
  },
  doNotEnter: {
    name: "Do Not Enter", family: "Regulatory",
    meaning: "Do not enter this road or ramp. Used for one-way streets, exit ramps, and restricted roads — entering means driving against traffic.",
    alt: { UK: { name: "No Entry", meaning: "Do not enter this road or slip road. It stands at the wrong end of a one-way street and at motorway slip roads, so going against it puts you into a head-on conflict with traffic using the road correctly." } },
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
    alt: { UK: { name: "One Way", meaning: "Traffic may travel only in the direction the arrow shows. Turning against it is an offence and puts you into a head-on conflict." } },
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
    meaning: "Left turns are prohibited at this junction. Continue and make the turn elsewhere (e.g., three right turns around the block).",
    alt: { UK: { name: "No Left Turn", meaning: "A left turn is prohibited at this junction. Continue past the junction and turn left where it is permitted, or find another route — the order applies for as long as the sign does." } },
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
    alt: { UK: { name: "Keep Right", meaning: "Pass to the right of the island, bollard or obstruction ahead. On a road where you drive on the left this keeps you clear of the island without crossing the centre line." } },
    svg: `<circle cx="50" cy="50" r="45" fill="#1c4e9c"/>` +
      `<line x1="34" y1="28" x2="60" y2="58" stroke="#fff" stroke-width="9" stroke-linecap="round"/>` +
      `<polyline points="72,42 72,60 54,60" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  keepLeft: {
    name: "Keep Left", family: "Mandatory",
    meaning: "Pass to the left of the island, bollard or obstruction ahead.",
    alt: { UK: { name: "Keep Left", meaning: "Pass to the left of the island, bollard or obstruction ahead. On a road where you drive on the left this keeps you clear of the island without crossing the centre line." } },
    svg: `<circle cx="50" cy="50" r="45" fill="#1c4e9c"/>` +
      `<line x1="66" y1="28" x2="40" y2="58" stroke="#fff" stroke-width="9" stroke-linecap="round"/>` +
      `<polyline points="28,42 28,60 46,60" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  noPassingZone: {
    name: "No Passing Zone (pennant)", family: "Warning — pennant",
    meaning: "The pennant marks the START of a no-passing zone on the left side of the road. Do not pass another vehicle from here until the zone ends.",
    svg: `<polygon points="4,10 88,42 4,74" fill="${YEL}" stroke="#111" stroke-width="3"/>${txt(30, 40, "NO", 11, "#111")}${txt(30, 54, "PASSING", 8, "#111")}${txt(30, 66, "ZONE", 9, "#111")}`
  },
  railCrossing: {
    name: "Railroad Crossing Ahead", family: "Warning — round",
    meaning: "You are approaching a railroad crossing. Slow down, look and listen for trains, and be prepared to stop. Never stop on the tracks.",
    alt: { UK: { name: "Level Crossing Ahead", meaning: "A level crossing is ahead. Obey the lights, gates or barriers without exception, never stop on the crossing, and never rely on being able to see or hear a train approaching." } },
    svg: `<circle cx="50" cy="50" r="46" fill="${YEL}" stroke="#111" stroke-width="4"/>
      <text x="27" y="36" font-family="${FONT}" font-weight="900" font-size="26" fill="#111">R</text>
      <text x="56" y="36" font-family="${FONT}" font-weight="900" font-size="26" fill="#111">R</text>
      <line x1="18" y1="30" x2="82" y2="70" stroke="#111" stroke-width="7"/>
      <line x1="18" y1="70" x2="82" y2="30" stroke="#111" stroke-width="7"/>`
  },
  pedCrossing: {
    name: "Pedestrian Crossing", family: "Warning",
    meaning: "People may be crossing ahead. Slow down, scan the sidewalks, and be ready to stop and yield to pedestrians in the crosswalk.",
    alt: { UK: { name: "Pedestrian Crossing", meaning: "People may be crossing ahead. Slow down, scan the footway on both sides, and be ready to stop and give way to pedestrians who are crossing." } },
    svg: diamond(YEL, person(50, 58, 1.15, "#111"))
  },
  schoolZone: {
    name: "School Zone", family: "Warning — pentagon (school)",
    meaning: "A school crossing area ahead. Slow to the posted school limit, watch for children, and obey crossing guards. Fluorescent yellow-green pentagon = school.",
    alt: { UK: { name: "School Zone", meaning: "A school or crossing patrol area is ahead. Slow to the signed limit, watch for children on the pavement and at the kerb, and obey the crossing patrol." } },
    svg: `<polygon points="50,4 95,36 78,94 22,94 5,36" fill="${YGR}" stroke="#111" stroke-width="3.5"/>
      ${person(36, 58, 0.9, "#111")}${person(60, 58, 0.9, "#111")}`
  },
  schoolCrossing: {
    name: "School Crossing", family: "Warning — pentagon (school)",
    meaning: "Children cross the road here, often with a crossing guard. Slow down, stop for children in the crosswalk, and never pass another vehicle stopped for the crossing.",
    alt: { UK: { name: "School Crossing", meaning: "Children cross here, often with a crossing patrol. Slow right down, stop for anyone on the crossing, and never pass a vehicle that has stopped for it." } },
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
    alt: { UK: { name: "Road Works Ahead", meaning: "Temporary signs mark a works area on this road. Slow down, leave room for the works and any workers on foot, and obey any temporary signals and speed limits in force." } },
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
    alt: { UK: { name: "Signals Ahead", meaning: "Traffic signals are just ahead, often hidden by a bend or a brow. Ease off the accelerator and be ready to stop." } },
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
    alt: { UK: { name: "Stop Sign Ahead", meaning: "A stop sign is ahead and may be hard to see over a brow or round a bend. Start slowing now and be ready to come to a complete stop." } },
    svg: diamond(YEL,
      `<polygon points="38,26 62,26 74,38 74,62 62,74 38,74 26,62 26,38" fill="${RED}"/>${txt(50, 54, "STOP", 13, "#fff")}`)
  },
  bikeCrossing: {
    name: "Bicycle Crossing", family: "Warning",
    meaning: "Bicyclists cross or share the road ahead. Slow down, check for riders, and give at least 3 feet when passing.",
    alt: { UK: { name: "Cycle Route Ahead", meaning: "Pedal cycles cross or share the road ahead. Slow down, check for riders on both sides, and leave at least 1.5 metres when you pass a cyclist, more at higher speeds." } },
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
    alt: { UK: { name: "Chevron (sharp bend)", meaning: "A sharp bend follows in the direction the chevrons point. Slow down before the bend, keep left of the markers, and do not brake while turning through it." } },
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
  noOvertaking: {
    name: "No Overtaking", family: "Regulatory — prohibition",
    meaning: "You must not overtake moving traffic on this stretch of road. The ban applies from the sign until you pass the sign that cancels it, and the red ring marks it as an order, not advice.",
    svg: `<circle cx="50" cy="50" r="46" fill="#fff" stroke="${RED}" stroke-width="9"/>` +
      `<g fill="#111" stroke="none"><rect x="14" y="46" width="28" height="13" rx="3"/><rect x="19" y="39" width="15" height="8" rx="2"/><circle cx="22" cy="61" r="4"/><circle cx="37" cy="61" r="4"/></g>` +
      `<g fill="${RED}" stroke="none"><rect x="54" y="46" width="28" height="13" rx="3"/><rect x="61" y="39" width="15" height="8" rx="2"/><circle cx="59" cy="61" r="4"/><circle cx="74" cy="61" r="4"/></g>`
  },
  noWaiting: {
    name: "No Waiting", family: "Regulatory — prohibition",
    meaning: "Waiting is prohibited along this road during the times shown on the plate below the sign. Stopping briefly for passengers to board or alight, or to load where loading is not also restricted, is different from waiting.",
    svg: `<circle cx="50" cy="50" r="45" fill="${BLU}" stroke="${RED}" stroke-width="10"/><line x1="22" y1="78" x2="78" y2="22" stroke="${RED}" stroke-width="11" stroke-linecap="round"/>`
  },
  noStopping: {
    name: "No Stopping (Clearway)", family: "Regulatory — prohibition",
    meaning: "Stopping is prohibited on this length of road, even to set down or pick up passengers, except as a plate below the sign allows. The red cross on blue makes it the strictest of the circular prohibitions.",
    svg: `<circle cx="50" cy="50" r="45" fill="${BLU}" stroke="${RED}" stroke-width="10"/>` +
      `<line x1="24" y1="76" x2="76" y2="24" stroke="${RED}" stroke-width="10" stroke-linecap="round"/>` +
      `<line x1="24" y1="24" x2="76" y2="76" stroke="${RED}" stroke-width="10" stroke-linecap="round"/>`
  },
  speedLimit30: {
    name: "Speed Limit 30", family: "Regulatory — speed limit",
    meaning: "You must not exceed 30 mph on this road. The figure is a maximum for ideal conditions; rain, fog, parked vehicles and people walking may all make a lower speed appropriate.",
    svg: `<circle cx="50" cy="50" r="45" fill="#fff" stroke="${RED}" stroke-width="10"/>${txt(50, 66, "30", 44, "#111")}`
  },
  nationalSpeedLimit: {
    name: "National Speed Limit", family: "Regulatory — speed limit",
    meaning: "The national speed limit for the class of road and type of vehicle applies from here. The sign prints no figure because the correct speed depends on both the road and what you are driving.",
    alt: { UK: { name: "National Speed Limit", meaning: "The national limit for the road and your vehicle applies here: 60 mph for a car on a single carriageway, 70 mph on a dual carriageway or motorway, and 30 mph on a lit road unless signs show otherwise." } },
    svg: `<circle cx="50" cy="50" r="45" fill="#fff" stroke="#111" stroke-width="5"/><line x1="15" y1="85" x2="85" y2="15" stroke="#111" stroke-width="13" stroke-linecap="round"/>`
  },
  minimumSpeed30: {
    name: "Minimum Speed 30", family: "Mandatory — minimum speed",
    meaning: "A minimum speed of 30 mph applies on this road. Drive at or above the figure unless it is unsafe or impracticable to comply, because traffic behind is entitled to expect that pace.",
    alt: { UK: { name: "Minimum Speed Limit 30", meaning: "You must not drive below 30 mph here unless it is unsafe or impracticable to comply. The blue circle makes the figure a floor to keep above, not a maximum to stay under." } },
    svg: `<circle cx="50" cy="50" r="45" fill="#1c4e9c" stroke="#fff" stroke-width="3"/>${txt(50, 66, "30", 44, "#fff")}`
  },
  endOfSpeedLimitZone: {
    name: "End of Speed Limit Zone", family: "Regulatory — zone end",
    meaning: "The signed zone ends here and the maximum speed shown on the panel applies from this point. A specific figure replaces the zone limit rather than returning the road to its default.",
    alt: { UK: { name: "End of 20 mph Zone", meaning: "The 20 mph zone ends here and the 30 mph maximum on the panel applies onward. The panel hands you a specific limit, so read the figure rather than assuming the national limit returns." } },
    svg: `<rect x="14" y="6" width="72" height="88" rx="3" fill="#fff" stroke="#111" stroke-width="4"/>${txt(50, 32, "END", 16, "#111")}<circle cx="50" cy="66" r="21" fill="#fff" stroke="${RED}" stroke-width="6"/>${txt(50, 76, "30", 21, "#111")}`
  },
  turnLeftAhead: {
    name: "Turn Left Ahead", family: "Mandatory — blue circle",
    meaning: "You must turn left where the instruction applies. Blue circles give orders rather than advice, so continuing straight past this sign is an offence.",
    svg: `<circle cx="50" cy="50" r="45" fill="#1c4e9c"/>` +
      `<g fill="#fff" stroke="none"><rect x="44" y="26" width="13" height="42"/><polygon points="28,36 50.5,16 73,36"/><rect x="30" y="56" width="27" height="13"/><polygon points="38,48 14,62.5 38,77"/></g>`
  },
  miniRoundabout: {
    name: "Mini-roundabout", family: "Mandatory — blue circle",
    meaning: "A mini-roundabout is ahead. Give way to traffic coming from your right and pass around the central marking, except where your vehicle is physically unable to do so.",
    svg: `<circle cx="50" cy="50" r="45" fill="#1c4e9c"/>` +
      `<circle cx="50" cy="50" r="9" fill="#fff"/>` +
      `<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"><path d="M20,54 A30,30 0 0 1 40,22"/><path d="M62,22 A30,30 0 0 1 80,54"/><path d="M72,78 A30,30 0 0 1 28,78"/></g>` +
      `<polygon points="34,17 52,26 36,33" fill="#fff"/><polygon points="86,46 84,64 70,54" fill="#fff"/><polygon points="16,72 26,86 32,71" fill="#fff"/>`
  },
  busLane: {
    name: "Bus Lane", family: "Mandatory — route for specified traffic",
    meaning: "The lane ahead is reserved for buses during the hours shown on the plate. Other traffic should not use the lane at those times, although you may enter it to stop or to load and unload where that is not prohibited.",
    svg: `<circle cx="50" cy="40" r="34" fill="#1c4e9c" stroke="#fff" stroke-width="3"/>` +
      `<g fill="#fff" stroke="none"><rect x="28" y="24" width="44" height="24" rx="4"/><rect x="33" y="29" width="11" height="8"/><rect x="47" y="29" width="11" height="8"/><rect x="61" y="29" width="7" height="8"/><circle cx="38" cy="52" r="5"/><circle cx="62" cy="52" r="5"/></g>` +
      `<rect x="14" y="78" width="72" height="16" fill="#fff" stroke="#111" stroke-width="2"/>${txt(50, 91, "BUS LANE", 11, "#111")}`
  },
  cycleRoute: {
    name: "Route for Pedal Cycles", family: "Mandatory — route for specified traffic",
    meaning: "This route is reserved for pedal cycles. Expect cyclists ahead, and when you pass one leave at least 1.5 metres of space at speeds up to 30 mph, and more at higher speeds.",
    svg: `<circle cx="50" cy="50" r="45" fill="#1c4e9c"/>` +
      `<g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><circle cx="32" cy="64" r="13"/><circle cx="68" cy="64" r="13"/><path d="M32,64 L45,42 L62,42 M58,64 L48,42 M45,42 L41,34 M62,42 L66,34"/></g>` +
      `<circle cx="41" cy="29" r="5" fill="#fff"/>`
  },
  crossroadsAhead: {
    name: "Crossroads Ahead", family: "Warning — red triangle",
    meaning: "A crossroads is ahead where neither road has priority over the other. Slow down and be ready to give way, and watch for traffic turning across you.",
    svg: `<polygon points="50,6 96,88 4,88" fill="#fff" stroke="${RED}" stroke-width="8"/>` +
      `<g fill="#111" stroke="none"><rect x="45" y="32" width="10" height="40"/><rect x="27" y="46" width="46" height="10"/></g>`
  },
  roadNarrowsBoth: {
    name: "Road Narrows on Both Sides", family: "Warning — red triangle",
    meaning: "The carriageway narrows on both sides ahead. Slow down in good time, check for oncoming vehicles, and be ready to give way where there is no longer room for two.",
    svg: `<polygon points="50,6 96,88 4,88" fill="#fff" stroke="${RED}" stroke-width="8"/>` +
      `<g fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"><path d="M28,78 L38,38 L46,26"/><path d="M72,78 L62,38 L54,26"/></g>`
  },
  levelCrossingGate: {
    name: "Level Crossing with Gate or Barrier", family: "Warning — level crossing",
    meaning: "A level crossing with a gate or barrier is ahead. Slow to a speed that lets you stop, obey the flashing lights and the barriers, and never cross while they are lowering or down.",
    svg: `<polygon points="50,6 96,88 4,88" fill="#fff" stroke="${RED}" stroke-width="8"/>` +
      `<g fill="#111" stroke="none"><rect x="22" y="34" width="8" height="38"/><rect x="32" y="38" width="46" height="6"/><rect x="32" y="52" width="46" height="6"/><rect x="38" y="38" width="5" height="20"/><rect x="52" y="38" width="5" height="20"/><rect x="66" y="38" width="5" height="20"/></g>`
  },
  levelCrossingOpen: {
    name: "Level Crossing without Gate or Barrier", family: "Warning — level crossing",
    meaning: "A level crossing with no gate or barrier is ahead. Stop where you can see the line, look both ways, listen for trains, and cross only when you are sure none is coming.",
    svg: `<polygon points="50,6 96,88 4,88" fill="#fff" stroke="${RED}" stroke-width="8"/>` +
      `<g fill="#111" stroke="none"><rect x="26" y="58" width="48" height="16"/><rect x="36" y="44" width="16" height="14"/><rect x="34" y="36" width="7" height="9"/><rect x="58" y="50" width="12" height="8"/><rect x="24" y="74" width="52" height="4"/><circle cx="34" cy="78" r="4"/><circle cx="50" cy="78" r="4"/><circle cx="66" cy="78" r="4"/></g>`
  },
  levelCrossingWigwag: {
    name: "Level Crossing Lights (Wigwag)", family: "Level crossing — signals",
    meaning: "Twin flashing red lights at a level crossing mean STOP, and the steady amber light that shows first also means stop unless it is unsafe to do so. Wait until the lights go out before crossing.",
    svg: `<rect x="16" y="8" width="68" height="84" rx="5" fill="#111" stroke="#fff" stroke-width="3"/>` +
      `<g fill="${RED}" stroke="none"><rect x="16" y="8" width="11" height="9"/><rect x="39" y="8" width="11" height="9"/><rect x="62" y="8" width="11" height="9"/><rect x="27" y="83" width="11" height="9"/><rect x="50" y="83" width="11" height="9"/><rect x="73" y="83" width="11" height="9"/></g>` +
      `<circle cx="35" cy="36" r="11" fill="${RED}"/><circle cx="65" cy="36" r="11" fill="${RED}"/><circle cx="50" cy="68" r="11" fill="#e8b31a"/>`
  },
  stAndrewsCross: {
    name: "St Andrew's Cross (Level Crossing)", family: "Level crossing",
    meaning: "This saltire marks a level crossing that has no gate or barrier and often no lights. Stop, look both ways and listen for trains, give way to them, and never stop on the crossing.",
    svg: `<g transform="rotate(45 50 50)"><rect x="16" y="42" width="68" height="16" fill="#fff" stroke="${RED}" stroke-width="5"/><rect x="42" y="16" width="16" height="68" fill="#fff" stroke="${RED}" stroke-width="5"/></g>`
  },
  tempRoadWorks: {
    name: "Road Works Ahead (temporary)", family: "Temporary — yellow ground",
    meaning: "Road works or an obstruction of the carriageway is ahead. Slow down, obey any temporary speed limit and signals, and expect workers and machines close to the traffic lanes.",
    svg: `<rect x="4" y="14" width="92" height="72" fill="${YEL}" stroke="#111" stroke-width="3"/>` +
      `<polygon points="50,20 78,70 22,70" fill="#fff" stroke="${RED}" stroke-width="6"/>` +
      `<g stroke="#111" stroke-width="5" stroke-linecap="round"><circle cx="42" cy="34" r="5" fill="#111"/><line x1="42" y1="40" x2="42" y2="56"/><line x1="42" y1="44" x2="33" y2="53"/><line x1="42" y1="44" x2="52" y2="52"/><line x1="42" y1="56" x2="36" y2="68"/><line x1="42" y1="56" x2="48" y2="68"/><line x1="58" y1="68" x2="58" y2="48"/><rect x="53" y="41" width="10" height="8" fill="#111"/></g>`
  },
  tempEndRoadWorks: {
    name: "End of Road Works (temporary)", family: "Temporary — yellow ground",
    meaning: "The works and any temporary restrictions end here, so the permanent signs and speed limits apply again from this point onward.",
    svg: `<rect x="4" y="10" width="92" height="80" fill="${YEL}" stroke="#111" stroke-width="3"/>` +
      `<polygon points="50,16 74,58 26,58" fill="#fff" stroke="${RED}" stroke-width="5"/>` +
      `<g stroke="#111" stroke-width="4" stroke-linecap="round"><circle cx="43" cy="28" r="4" fill="#111"/><line x1="43" y1="33" x2="43" y2="46"/><line x1="43" y1="36" x2="36" y2="43"/><line x1="43" y1="36" x2="51" y2="42"/><line x1="43" y1="46" x2="38" y2="55"/><line x1="43" y1="46" x2="48" y2="55"/><line x1="56" y1="55" x2="56" y2="39"/><rect x="52" y="33" width="8" height="7" fill="#111"/></g>` +
      `${txt(50, 82, "END", 16, "#111")}`
  },
  tempRoadClosed: {
    name: "Road Closed (temporary)", family: "Temporary — yellow ground",
    meaning: "The road ahead is closed to traffic, often for works or an incident. Follow the signed diversion route and do not pass the sign.",
    svg: `<rect x="4" y="24" width="92" height="52" fill="${YEL}" stroke="#111" stroke-width="3"/>${txt(50, 46, "ROAD", 19, "#111")}${txt(50, 67, "CLOSED", 19, "#111")}`
  },
  motorwayDirection: {
    name: "Motorway Direction Sign", family: "Direction — motorway",
    meaning: "Blue backgrounds with white lettering and symbols are the motorway signing system, showing destinations, route numbers and junction numbers ahead.",
    svg: `<rect x="6" y="14" width="88" height="72" rx="4" fill="${BLU}" stroke="#fff" stroke-width="3"/>` +
      `${txt(50, 44, "M6 NORTH", 15, "#fff")}${txt(50, 66, "Birmingham", 13, "#fff")}` +
      `<rect x="68" y="20" width="20" height="13" fill="#111"/>${txt(78, 30, "J28", 9, "#fff")}`
  },
  directionPrimary: {
    name: "Primary Route Direction Sign", family: "Direction — primary route",
    meaning: "Green backgrounds with white lettering and yellow route numbers sign primary routes, the main roads that carry long-distance traffic between major towns and cities.",
    svg: `<rect x="6" y="14" width="88" height="72" rx="4" fill="${GRN}" stroke="#fff" stroke-width="3"/>` +
      `${txt(50, 44, "Exeter", 16, "#fff")}${txt(50, 66, "Plymouth", 13, "#fff")}${txt(80, 30, "A38", 11, "#ffd400")}`
  },
  directionLocal: {
    name: "Local Direction Sign", family: "Direction — non-primary route",
    meaning: "White backgrounds with black lettering and black route numbers sign local or non-primary routes, the everyday destinations away from the strategic network.",
    svg: `<rect x="6" y="14" width="88" height="72" rx="4" fill="#fff" stroke="#111" stroke-width="3"/>` +
      `${txt(50, 44, "Town Centre", 13, "#111")}${txt(50, 66, "Station", 13, "#111")}`
  },
  waitingTimesPlate: {
    name: "Waiting Restriction Time Plate", family: "Supplementary plate",
    meaning: "A yellow plate below a waiting or parking order giving the days and times the order operates. The sign above bites only during the period the plate shows; outside those times the order is not in force.",
    svg: `<rect x="6" y="32" width="88" height="36" fill="${YEL}" stroke="#111" stroke-width="3"/>${txt(50, 56, "MON-SAT 8-6", 15, "#111")}`
  },
  loadingRestrictionPlate: {
    name: "Loading Restriction Plate", family: "Supplementary plate",
    meaning: "A white plate combined with a no waiting plate, giving the times when loading is also banned and an arrow for the direction that ban runs in. The arrow belongs only to the white panel it is printed on, not to the whole plate.",
    svg: `<rect x="6" y="32" width="88" height="36" fill="#fff" stroke="#111" stroke-width="3"/>${txt(38, 55, "7AM-7PM", 13, "#111")}<line x1="58" y1="50" x2="82" y2="50" stroke="#111" stroke-width="5"/><polygon points="82,41 94,50 82,59" fill="#111"/>`
  },
  motorwayServices: {
    name: "Motorway Services", family: "Information — motorway services",
    meaning: "Blue panels with white symbols show motorway service areas ahead, with the distance to the exit. Leave the motorway at the signposted exit; stopping on the hard shoulder is not allowed.",
    svg: `<rect x="6" y="14" width="88" height="72" rx="4" fill="${BLU}" stroke="#fff" stroke-width="3"/>` +
      `${txt(50, 38, "SERVICES", 13, "#fff")}` +
      `<path d="M36,52 L62,52 L58,72 L40,72 Z" fill="#fff" stroke="none"/><path d="M63,57 q9,2 7,10 q-2,7 -9,6" fill="none" stroke="#fff" stroke-width="4"/>` +
      `<path d="M30,48 q2,-8 6,-10 M42,48 q2,-8 6,-10" fill="none" stroke="#fff" stroke-width="3"/>`
  },
};

/* Consumed as globals by app.js (classic scripts, one shared scope). */
/* exported SIGNS, signSVG */
function signSVG(id, size, label) {
  const s = SIGNS[id];
  if (!s) return "";
  const px = size ? ` width="${size}" height="${size}"` : "";
  return `<svg viewBox="0 0 100 100"${px} role="img" aria-label="${label || s.name} sign">${s.svg}</svg>`;
}
