// Security headers contract: vercel.json (production) and serve.js (local/E2E)
// must keep the same strict policy. If you strengthen one, strengthen both.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const vercel = JSON.parse(readFileSync(`${ROOT}vercel.json`, "utf8"));
const serveSrc = readFileSync(`${ROOT}serve.js`, "utf8");

const vercelRoot = vercel.headers.find(
  (h) => h.source === "/(.*)" && h.headers.some((x) => x.key === "Content-Security-Policy"),
);
const vercelApi = vercel.headers.find(
  (h) => h.source === "/api/(.*)",
);

const headerValue = (group, key) =>
  group && group.headers.find((h) => h.key === key)?.value;

const CSP_DIRECTIVES = (csp) => Object.fromEntries(
  String(csp).split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map((d) => [d[0], d.slice(1)]),
);

describe("production security headers (vercel.json)", () => {
  it("ships a strict CSP on every document response", () => {
    expect(headerValue(vercelRoot, "Content-Security-Policy")).toBeTruthy();
  });

  it("forbids inline and eval'd scripts", () => {
    const script = CSP_DIRECTIVES(headerValue(vercelRoot, "Content-Security-Policy"))["script-src"];
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script.filter((t) => !t.startsWith("'"))).toEqual([]);
  });

  it("keeps anti-framing protections", () => {
    const csp = CSP_DIRECTIVES(headerValue(vercelRoot, "Content-Security-Policy"));
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(headerValue(vercelRoot, "X-Frame-Options")).toBe("DENY");
  });

  it("does not open the policy up to third-party script origins", () => {
    const csp = CSP_DIRECTIVES(headerValue(vercelRoot, "Content-Security-Policy"));
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
  });

  it("allows the origins the app legitimately needs", () => {
    const csp = CSP_DIRECTIVES(headerValue(vercelRoot, "Content-Security-Policy"));
    // Google profile images on account screens + inline SVG/data icons + PWA manifest + service worker.
    expect(csp["img-src"]).toContain("https://*.googleusercontent.com");
    expect(csp["img-src"]).toContain("data:");
    expect(csp["manifest-src"]).toEqual(["'self'"]);
    expect(csp["worker-src"]).toEqual(["'self'"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
  });

  it("keeps nosniff, referrer and permissions policies in place", () => {
    expect(headerValue(vercelRoot, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(vercelRoot, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerValue(vercelRoot, "Permissions-Policy")).toContain("camera=()");
    expect(headerValue(vercelApi, "Referrer-Policy")).toBe("no-referrer");
    expect(headerValue(vercelApi, "Cache-Control")).toContain("no-store");
  });
});

describe("local server header parity (serve.js)", () => {
  const cspBlock = serveSrc.slice(serveSrc.indexOf("const CSP"), serveSrc.indexOf("http.createServer"));
  const servedCsp = [...cspBlock.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("");

  it("serves the same CSP verbatim so E2E runs exercise production policy", () => {
    const prod = headerValue(vercelRoot, "Content-Security-Policy");
    // The production CSP with upgrade-insecure-requests removed for plain HTTP.
    expect(servedCsp).toBe(prod.replace(/; upgrade-insecure-requests/, ""));
  });

  it("answers the session endpoint like a deployment without accounts", () => {
    expect(serveSrc).toContain("/api/auth/session");
  });
});
