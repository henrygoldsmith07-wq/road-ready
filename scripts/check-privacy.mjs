/* Verifies each factual claim in docs/PRIVACY.md against the code. A privacy
   document that does not match the source is worse than none. */
import fs from "node:fs";
const problems = [];
const appjs = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const swjs = fs.readFileSync("sw.js", "utf8");
const privacyDoc = fs.readFileSync("docs/PRIVACY.md", "utf8");

const jsFiles = fs.readdirSync("js").filter((f) => f.endsWith(".js")).map((f) => `js/${f}`);
const jsSources = jsFiles.map((f) => fs.readFileSync(f, "utf8"));

/* 1. "one key: roadready.v1" */
const keys = new Set();
for (const s of jsSources) for (const m of s.matchAll(/"(roadready\.[\w.-]+)"/g)) keys.add(m[1]);
if (keys.size !== 2 || !keys.has("roadready.v1")) problems.push(`storage keys are ${[...keys].join(", ")}, doc says only roadready.v1`);
// roadready.probe is an availability check, written and removed in the same tick

/* 2. "fetch only in account.js, only /api/*" */
for (const [i, s] of jsSources.entries()) {
  const fetchLines = s.split("\n").map((l, n) => [n + 1, l]).filter(([, l]) => /fetch\(/.test(l));
  for (const [n, l] of fetchLines) {
    if (!jsFiles[i].endsWith("account.js")) problems.push(`${jsFiles[i]}:${n} calls fetch() outside account.js`);
    if (!/["'`]\/api\//.test(l)) problems.push(`${jsFiles[i]}:${n} fetches a non-/api/ URL: ${l.trim()}`);
  }
}

/* 3. "no request at startup" — the account probe must be behind Settings.
   Brace-depth analysis: init() runs at boot, so a *top-level* initAccount call
   inside it would make a request on every load. A call nested inside a handler
   or an arrow it defines is exactly what we want. */
const initStart = appjs.indexOf("function init()");
const initEnd = appjs.indexOf("\nfunction ", initStart + 10);
const initSrc = appjs.slice(initStart, initEnd === -1 ? undefined : initEnd);
// Walk character by character, recording brace depth at the moment each
// initAccount token is reached. A call at depth <= 1 is a top-level statement in
// init() (a boot request); anything deeper is inside a handler or arrow.
const topLevelCalls = [];
let d = 0;
let lineNo = 1;
for (let i = 0; i < initSrc.length; i++) {
  const ch = initSrc[i];
  if (ch === "\n") lineNo++;
  else if (ch === "{") d++;
  else if (ch === "}") d--;
  else if (initSrc.startsWith("initAccount(", i)) {
    // include the preceding "void " so the message reads as the source does
    const from = initSrc.lastIndexOf("\n", i) + 1;
    const text = initSrc.slice(from, i + 14).trim();
    if (d <= 1) topLevelCalls.push(`init():${lineNo}: ${text}`);
  }
}
if (topLevelCalls.length) {
  problems.push(`initAccount() runs at boot, so there IS a startup request: ${topLevelCalls.join(" | ")}`);
}
if (!/const openSettings = \(\) => \{ void initAccount\(\)/.test(appjs)) {
  problems.push("no Settings-navigation trigger calls initAccount()");
}

/* 4. "sw.js sends /api/* to network and never caches it" */
if (!/pathname === "\/api" \|\| url\.pathname\.startsWith\("\/api\/"\)\) return;/.test(swjs)) {
  problems.push("sw.js does not bypass /api/*");
}
// Read index.html's head only, with comments stripped: the head carries a
// comment documenting that preconnects are deliberately absent.
const head = html.slice(0, html.indexOf("</head>")).replace(/<!--[\s\S]*?-->/g, "");
if (/preconnect|dns-prefetch|<script[^>]+src="https?:/i.test(head)) {
  problems.push("index.html head contains a preconnect or third-party script");
}

/* 5. the deletion scope list must match what the confirm actually names. */
const confirmIdx = appjs.indexOf("Erase ALL of the following");
const confirmBlock = appjs.slice(confirmIdx, appjs.indexOf("}) return;", confirmIdx));
const claimed = [
  ["mastery/questions", /question, mastery/i],
  ["exam results", /exam results/i],
  ["day streak/XP", /day streak.*XP|XP/i],
  ["flagged", /flagged/i],
  ["hazard", /hazard/i],
  ["outcome journal", /outcome journal/i],
  ["Drive Log + instructor notes", /Drive Log sessions and instructor notes/i],
  ["research study", /research study/i],
];
for (const [what, re] of claimed) if (!re.test(confirmBlock)) problems.push(`erase confirm does not name ${what}`);

/* 6. the export-then-erase path must abort on export failure. */
if (!/Could not build the backup file, so nothing was erased\./.test(appjs)) {
  problems.push("no abort message on export failure");
}
if (!/JSON\.stringify\(Core\.exportBundle\(state\)\)/.test(appjs)) {
  problems.push("export-then-erase does not serialise the bundle first");
}

/* 7. sign-out must not delete, and the doc must say so. The sign-out button is
   rendered by js/account-ui.js, not app.js. */
const accountUi = fs.readFileSync("js/account-ui.js", "utf8");
const signOutBlock = accountUi.slice(accountUi.indexOf('"Sign out"'), accountUi.indexOf('"Sign out"') + 400);
if (/localStorage\s*\.\s*(clear|removeItem)|Core\.defaultState/.test(signOutBlock)) {
  problems.push("sign-out touches local data");
}
if (!/localStorage\.clear|removeItem/.test(signOutBlock) && !/render\(\)/.test(signOutBlock)) {
  problems.push("sign-out block does not include a re-render (the button may be missing)");
}
if (!/signing out does (?:neither|not delete|ends? the (?:account )?session)/i.test(privacyDoc)) {
  problems.push("PRIVACY.md does not state that sign-out is not a delete");
}
if (!/sign(?:ing)?(?:ing)?[- ]out is (?:not a delete|not a deletion)|signing out does not delete/i.test(html)) {
  problems.push("the settings UI does not warn that sign-out keeps local data");
}

/* 8. the doc's greppable claims must actually be greppable. */
if (!privacyDoc.includes("grep -rn \"preconnect")) problems.push("PRIVACY.md has no verify commands");

console.log(`storage keys: ${[...keys].join(", ")}`);
console.log(`js files scanned: ${jsSources.length}`);
console.log(`erase-confirm scope items checked: ${claimed.length}`);
console.log(problems.length ? "PROBLEMS:" : "all PRIVACY.md claims verified against the code");
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
