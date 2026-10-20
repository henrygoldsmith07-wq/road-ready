/* Minimal static file server for local testing.
 * Serves the same security headers as the production (Vercel) deployment so
 * Lighthouse/E2E runs exercise the same Content-Security-Policy the app ships
 * with — a policy that only passes here is the policy that actually works. */
const http = require("http");
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const root = __dirname;
/* Full MIME map matters here: with `X-Content-Type-Options: nosniff` a wrong
 * type can break manifest/icon fetching, and this server exists so local runs
 * exercise the real thing. Production (Vercel) already serves these types. */
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; " +
  "img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self'; font-src 'self'; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; " +
  "manifest-src 'self'; worker-src 'self'";
http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    // Malformed percent-encoding: refuse the request, don't crash the server.
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("bad request");
  }
  // Stand in for the serverless backend when accounts are not configured:
  // the session endpoint exists in production and answers "signed out", so a
  // local run must not log a console error Lighthouse would flag.
  if (urlPath === "/api/auth/session") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end('{"available":false,"user":null}');
  }
  if (urlPath.startsWith("/api/")) {
    res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end('{"error":"Sync is not configured for this deployment."}');
  }
  let p = urlPath;
  if (p === "/") p = "/index.html";
  const file = path.join(root, p);
  // root + separator: a bare prefix check would also admit ../road-ready-x/.
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("not found");
  }
  /* Mirror production: Vercel compresses text responses, so the local harness
     does too — otherwise Lighthouse measures a wire size no user ever sees. */
  const compressible = /\.(html|css|js|svg|webmanifest|json)$/.test(file);
  const accept = String(req.headers["accept-encoding"] || "");
  const headers = {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
  if (compressible && /\bgzip\b/.test(accept)) {
    headers["Content-Encoding"] = "gzip";
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
    return;
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(8321, () => console.log("serving on http://localhost:8321"));
