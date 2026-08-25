#!/usr/bin/env node
/* Road Ready — cross-project contamination guard.
 *
 * A foreign project's feature ("Argument Skill Profile" from the debate app)
 * once landed here via a parallel agent session. This scan makes that class of
 * accident fail CI: any tracked text file containing vocabulary from another
 * product domain is flagged for manual review.
 *
 *   node scripts/check-hygiene.mjs
 *
 * Add terms to FORBIDDEN as new contamination patterns are discovered.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "test-results", "playwright-report", "temp_repo"]);
const SCAN_EXT = /\.(js|mjs|cjs|html|css|md|json|webmanifest)$/i;

// Vocabulary that must never appear in this codebase (foreign product domains).
const FORBIDDEN = [
  { re: /argument[ -]?skill[ -]?profile/i, why: "debate-app feature" },
  { re: /\bsteel ?man(n?ing)?\b/i, why: "debate terminology" },
  { re: /\brebutta[lk]\b/i, why: "debate terminology" },
  { re: /\bclaim[- ]grading\b/i, why: "debate terminology" },
];

const hits = [];
function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!SCAN_EXT.test(f.name)) continue;
    let text;
    try { text = readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { re, why } of FORBIDDEN) {
        // allow this file's own rule definitions / docs about the guard itself
        if (rel === "scripts" + path.sep + "check-hygiene.mjs") continue;
        if (re.test(line) && !/\bforbidden|guard\b/i.test(line)) {
          hits.push(`${rel}:${i + 1}  [${why}]  ${line.trim().slice(0, 100)}`);
        }
      }
    });
  }
}
walk(ROOT);

if (hits.length) {
  console.error(`\nCONTAMINATION GUARD — ${hits.length} hit(s):\n` + hits.map((h) => "  - " + h).join("\n"));
  console.error(`\nRemove the foreign feature/code. If a hit is a false positive, refine the term (do not weaken it casually).`);
  process.exit(1);
}
console.log("hygiene: clean — no cross-project contamination detected");
