/* Minimal stroke icon set — 24x24, currentColor, pairs with the monochrome UI. */
"use strict";

const ICONS = {
  /* navigation & actions */
  home: `<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>`,
  clipboard: `<rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 2.5h6v4H9z"/><path d="M9 12h6"/><path d="M9 16h4"/>`,
  layers: `<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13.5 9 5 9-5"/>`,
  target: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>`,
  chart: `<path d="M4 20h16"/><path d="M7 20v-6"/><path d="M12 20V6"/><path d="M17 20v-9"/>`,
  flag: `<path d="M5.5 21V4"/><path d="M5.5 4.5c3.5-1.8 6.5 1.8 10 0V12c-3.5 1.8-6.5-1.8-10 0"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  check: `<path d="m5 13 4.5 4.5L19 7"/>`,
  x: `<path d="m6 6 12 12"/><path d="m18 6-12 12"/>`,
  "check-circle": `<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.5 2.5 2.5 4.5-5.5"/>`,
  "x-circle": `<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>`,
  "arrow-left": `<path d="M19 12H5"/><path d="m11 19-7-7 7-7"/>`,
  "arrow-right": `<path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>`,
  "chevron-right": `<path d="m9 5.5 6.5 6.5L9 18.5"/>`,
  "chevron-left": `<path d="m15 5.5-6.5 6.5L15 18.5"/>`,
  shuffle: `<path d="M4 6.5h3.5L17 17.5h3.5"/><path d="M4 17.5h3.5l2.6-3.1"/><path d="M13.6 9.6 17 6.5h3.5"/><path d="m18 3.5 3 3-3 3"/><path d="m18 14.5 3 3-3 3"/>`,
  rotate: `<path d="M3.5 8A9 9 0 1 1 3 13"/><path d="M3 3.5V8h4.5"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>`,
  moon: `<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>`,
  sparkles: `<path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4z"/><path d="m18.5 15.5.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/>`,
  zap: `<path d="M13 2.5 4.5 13.5h6L10 21.5l8.5-11h-6L13 2.5z"/>`,
  grad: `<path d="m2.5 9.5 9.5-4 9.5 4-9.5 4-9.5-4z"/><path d="M6.5 11.5v4.2c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.2"/><path d="M21.5 9.5v5"/>`,
  alert: `<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.5"/><path d="M12 17.5h.01"/>`,
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4.5c0 2.5 1.5 4 3.5 4"/><path d="M17 5h2.5c0 2.5-1.5 4-3.5 4"/><path d="M12 14v4"/><path d="M8.5 21h7"/>`,
  car: `<path d="M4 15.5 5.8 9a2 2 0 0 1 1.9-1.5h8.6a2 2 0 0 1 1.9 1.5l1.8 6.5"/><path d="M3.5 15.5h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>`,
  /* topic icons */
  octagon: `<path d="M8 3.5h8L20.5 8v8L16 20.5H8L3.5 16V8L8 3.5z"/>`,
  crossroad: `<path d="M12 3v7"/><path d="M12 14v7"/><path d="M3 12h7"/><path d="M14 12h7"/><circle cx="12" cy="12" r="1"/>`,
  gauge: `<path d="M5 19a9 9 0 1 1 14 0"/><path d="m12 14 3.5-3.5"/><circle cx="12" cy="14" r="1"/>`,
  parking: `<circle cx="12" cy="12" r="8.5"/><path d="M9.5 16.5v-9h3a2.8 2.8 0 0 1 0 5.6h-3"/>`,
  ban: `<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>`,
  shield: `<path d="M12 3 5 5.8v5.4c0 4.6 3 7.6 7 9.3 4-1.7 7-4.7 7-9.3V5.8L12 3z"/>`,
  scale: `<path d="M12 3.5v15"/><path d="M8 21h8"/><path d="M5 6.5h14"/><path d="M7 6.5 4 12a3 3 0 0 0 6 0L7 6.5z"/><path d="M17 6.5 14 12a3 3 0 0 0 6 0l-3-5.5z"/>`,
  lanes: `<path d="M4 5h16"/><path d="M4 12h3m5 0h3m5 0h3"/><path d="M4 19h16"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5c2.8.4 4.5 2.6 4.5 5.5"/>`,
  wrench: `<path d="M14.5 6.5a4.5 4.5 0 0 0-6 5.6L3 17.6 6.4 21l5.5-5.5a4.5 4.5 0 0 0 5.6-6l-2.9 2.9-2.5-.7-.7-2.5z"/>`,
  steering: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M4.2 9.5c2.8 1 5.3 1.6 7.8 3.4 2.5-1.8 5-2.4 7.8-3.4"/><path d="M12 14.5V21"/>`,
  volume: `<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>`,
  "volume-off": `<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/>`,
  award: `<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 8 5-3 5 3-1.5-8"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
  infinity: `<path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/>`,
};

function icon(name, size) {
  const body = ICONS[name];
  if (!body) return "";
  const s = size || 18;
  return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
/* fill declarative hooks: <span data-icon="name" data-size="18"></span> */
function hydrateIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach(el => {
    el.innerHTML = icon(el.dataset.icon, parseInt(el.dataset.size, 10) || 18);
  });
}
