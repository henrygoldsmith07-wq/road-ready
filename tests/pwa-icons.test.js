/* PWA install icons: the manifest must name 192px + 512px raster icons (the
 * sizes installability is evaluated against), every named file must exist,
 * and PNG dimensions must match the declared sizes. No image libraries:
 * PNG magic + IHDR are parsed by hand. */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const at = (p) => fileURLToPath(new URL(p, ROOT));
const manifest = JSON.parse(readFileSync(at("manifest.webmanifest"), "utf8"));
const index = readFileSync(at("index.html"), "utf8");

function pngSize(buf) {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("install icons", () => {
  it("declares 192px and 512px raster icons for installability", () => {
    const raster = manifest.icons.filter((i) => i.type === "image/png" && i.purpose === "any");
    expect(raster.map((i) => i.sizes)).toContain("192x192");
    expect(raster.map((i) => i.sizes)).toContain("512x512");
  });

  it("every manifest icon file exists, with PNG dimensions matching sizes", () => {
    for (const icon of manifest.icons) {
      const file = at(String(icon.src).replace(/^\.\//, ""));
      expect(existsSync(file), `${icon.src} exists`).toBe(true);
      if (icon.type === "image/png" && /^\d+x\d+$/.test(icon.sizes || "")) {
        const [w, h] = icon.sizes.split("x").map(Number);
        const got = pngSize(readFileSync(file));
        expect(got, `${icon.src} dimensions`).toEqual({ w, h });
      }
    }
  });

  it("iOS has an apple-touch-icon for the manual install path", () => {
    const m = index.match(/<link rel="apple-touch-icon" href="([^"]+)"/);
    expect(m, "apple-touch-icon link present").toBeTruthy();
    expect(existsSync(at(m[1].replace(/^\.\//, ""))), `${m[1]} exists`).toBe(true);
  });
});
