// Keeps sw.js's VERSION in lock-step with the actual content of the precached
// shell. The cache name is a short hash of every shell file, so:
//   - any changed asset byte => new VERSION => new cache name
//   - an unchanged shell keeps its VERSION (users don't re-download the app)
//   - a human can never forget to bump the version before deploying
//
// Run modes:
//   node scripts/update-sw.mjs           rewrite sw.js with the correct VERSION
//   node scripts/update-sw.mjs --check   exit 1 (no writes) if sw.js is stale
//
// `npm test` runs the rewrite so a local tree is always consistent; CI runs the
// check so a commit whose service worker was not regenerated cannot go green.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const swPath = new URL("../sw.js", import.meta.url);

const SW_SOURCE = readFileSync(swPath, "utf8");

// The single source of truth for the shell list lives in sw.js itself.
const shellMatch = SW_SOURCE.match(/const SHELL = \[([\s\S]*?)\];/);
if (!shellMatch) {
  console.error("update-sw: could not parse SHELL from sw.js");
  process.exit(1);
}
const shell = [...shellMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
if (!shell.length) {
  console.error("update-sw: SHELL list is empty");
  process.exit(1);
}

const hash = createHash("sha256");
for (const entry of shell) {
  const file = entry === "./" ? "index.html" : entry.replace(/^\.\//, "");
  hash.update(file);
  try {
    hash.update(readFileSync(new URL(`../${file}`, import.meta.url)));
  } catch {
    console.error(`update-sw: shell file missing on disk: ${file}`);
    process.exit(1);
  }
}
const VERSION = `v.${hash.digest("hex").slice(0, 12)}`;

const current = SW_SOURCE.match(/^const VERSION = "([^"]*)";$/m);
if (!current) {
  console.error("update-sw: could not find the VERSION line in sw.js");
  process.exit(1);
}

if (current[1] === VERSION) {
  console.log(`update-sw: sw.js VERSION is current (${VERSION})`);
  process.exit(0);
}

if (process.argv.includes("--check")) {
  console.error(`update-sw: sw.js VERSION is stale (${current[1]}; expected ${VERSION}).`);
  console.error("Run: npm run sw:version");
  process.exit(1);
}

writeFileSync(swPath, SW_SOURCE.replace(/^const VERSION = "([^"]*)";$/m, `const VERSION = "${VERSION}";`));
console.log(`update-sw: sw.js VERSION -> ${VERSION}`);
