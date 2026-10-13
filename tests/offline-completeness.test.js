/* Offline completeness: every script and stylesheet the page loads must be
   in the service worker's precache list. A module added to index.html without
   a SHELL entry silently breaks offline mode — this test makes that class of
   regression impossible to merge. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const index = readFileSync(fileURLToPath(new URL("index.html", ROOT)), "utf8");
const sw = readFileSync(fileURLToPath(new URL("sw.js", ROOT)), "utf8");
/* Manifest-referenced assets (install icons) are needed by the app even
 * though no <script>/<link> in index.html loads them — except the
 * apple-touch-icon, which is a page asset like any other. */
const manifestRefs = new Set(
  JSON.parse(readFileSync(fileURLToPath(new URL("manifest.webmanifest", ROOT)), "utf8"))
    .icons.map((i) => String(i.src || "").replace(/^\.\//, ""))
);

const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1]
  .split("\n")
  .map((line) => (line.match(/"([^"]+)"/) || [])[1])
  .filter(Boolean);
const shellSet = new Set(shell);

/** Assets the page loads directly (script src + stylesheet href).
 *  Inline `data:` URIs are self-contained and need no precache. */
const pageAssets = [...index.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => !/^(https?:|#|data:)/.test(p));
/* Modules fetched on demand through dynamic import() (e.g. the GB pack via
 * Packs.ensureUkPack) are loaded by the app exactly like a script tag for
 * offline purposes — the service worker caches them on first fetch. Resolve
 * each specifier against the importing file's directory. */
import { readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return jsFiles(p);
    return e.name.endsWith(".js") ? [p] : [];
  });
}
const dynamicImports = jsFiles(fileURLToPath(new URL("js", ROOT))).flatMap((file) => {
  const src = readFileSync(file, "utf8");
  // Static import("./x") specifiers resolve against the importing file.
  const fileRelative = [...src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) =>
    normalize(join(dirname(file), m[1]))
      .replace(/\\/g, "/")
      .replace(fileURLToPath(ROOT).replace(/\\/g, "/"), "")
      .replace(/^\//, "")
  );
  /* Classic scripts resolve dynamic import() against the document base URL,
   * not the importing file — so ensureUkPack builds its URL with new
   * URL("<document-relative>", document.baseURI). Those specifiers resolve
   * against the project root instead. */
  const docRelative = [...src.matchAll(/new URL\(\s*["']([^"']+)["']\s*,\s*document\.baseURI\s*\)/g)].map((m) =>
    normalize(m[1]).replace(/\\/g, "/").replace(/^\.\//, "")
  );
  return [...fileRelative, ...docRelative];
});

describe("offline completeness (service-worker precache)", () => {
  it("every page asset is precached so the app works offline", () => {
    const missing = pageAssets.filter((p) => !shellSet.has(p) && !shellSet.has("./" + p.replace(/^\.\//, "")));
    expect(missing, `not in sw.js SHELL: ${missing.join(", ")}`).toEqual([]);
  });

  it("the precache list contains no dead entries", () => {
    // Every SHELL entry (except the navigable root) must be a real file that
    // index.html loads or the app itself needs; a stale entry wastes cache.
    const loaded = new Set([
      ...pageAssets.map((p) => p.replace(/^\.\//, "")),
      ...dynamicImports,
    ]);
    const stale = shell
      .filter((p) => p !== "./" && !loaded.has(p.replace(/^\.\//, "")))
      // CSS and data files are loaded indirectly (link/href already matched),
      // and manifest icons are loaded by the installer, not the page;
      // anything else is a stale SHELL entry.
      .filter((p) => !/\.(css|html|webmanifest|svg)$/.test(p))
      .filter((p) => !manifestRefs.has(p.replace(/^\.\//, "")));
    expect(stale, `sw.js SHELL entries nothing loads: ${stale.join(", ")}`).toEqual([]);
  });

  it("the generated VERSION check mechanism is intact", () => {
    // The stale-cache guard must keep running: a hand-edited or removed check
    // would let deploys ship stale shells. The mechanism is update-sw.mjs.
    expect(sw).toMatch(/const VERSION = "v\.[0-9a-f]{12}";/);
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("package.json", ROOT)), "utf8"));
    expect(pkg.scripts["sw:version"]).toContain("update-sw.mjs");
    expect(pkg.scripts.verify).toContain("sw:version -- --check");
  });
});
