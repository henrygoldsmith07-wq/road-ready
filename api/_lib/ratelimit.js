// A small, dependency-free request rate limiter.
//
// Purpose and honest limits: this bounds how fast ONE serverless instance can
// be driven, which stops a single warm instance from absorbing an unbounded
// number of expensive operations (a 4 MB sync write, an OAuth start that mints
// a nonce and PKCE pair). It is not a distributed limit — Vercel runs many
// instances, so a determined attacker still spreads requests across them. It
// raises the cost of casual abuse and runaway clients; it is not a
// substitute for an edge-level rate limit.
//
// State is per instance and in memory: no external store, no added
// dependency, nothing to configure, and nothing to leak between users.

import { createHash } from 'node:crypto';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 30;

// Buckets keyed by a caller-supplied identity (an IP, a session id). Entries
// are removed once their window passes, so the map stays small.
const buckets = new Map();

/**
 * Registers one hit and reports whether it is over the limit.
 *
 * @param {string} key      caller identity (already privacy-preserving)
 * @param {number} [max]    hits allowed per window
 * @param {number} [windowMs]
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
 */
export function hit(key, max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS) {
  const now = Date.now();
  const id = String(key || "unknown");
  let bucket = buckets.get(id);

  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(id, bucket);
  }
  bucket.count += 1;

  // Opportunistic cleanup: a bucket that has expired is dead weight, and this
  // map is per instance, so keeping it small matters.
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) {
      if (now - b.start >= windowMs) buckets.delete(k);
    }
  }

  const allowed = bucket.count <= max;
  const remaining = Math.max(0, max - bucket.count);
  const retryAfterSeconds = allowed ? 0 : Math.ceil((bucket.start + windowMs - now) / 1000);
  return { allowed, remaining, retryAfterSeconds };
}

/** Clears every bucket. Test seam. */
export function resetLimiter() {
  buckets.clear();
}

/**
 * The caller's address, as trusted as the platform allows.
 *
 * A rate limit keyed on a header the caller controls is not a rate limit, so
 * the order below matters:
 *
 *  1. `x-vercel-forwarded-for` — set by the Vercel edge, which strips any
 *     client-supplied value. This is the one header here a caller cannot
 *     forge.
 *  2. `x-real-ip` — set by common reverse proxies, again overwritten.
 *  3. `x-forwarded-for` — APPEND-ONLY. The right-most entry was written by
 *     the proxy closest to this server and is the least caller-controlled.
 *     Taking the LEFT-most entry (the common mistake) would let a caller mint
 *     a fresh identity on every request and walk straight through the limit.
 *  4. The socket address, when the platform gives us one.
 */
function clientAddress(req) {
  const headers = (req && req.headers) || {};
  const vercel = headers['x-vercel-forwarded-for'];
  if (vercel) return lastEntry(vercel);
  const real = headers['x-real-ip'];
  if (real) return lastEntry(real);
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) return lastEntry(forwarded);
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

/** The right-most entry of a possibly comma-separated header value. */
function lastEntry(value) {
  const parts = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'unknown';
}

/**
 * A privacy-preserving caller identity for rate limiting.
 *
 * The raw IP is never stored: it is hashed with the process's AUTH_SECRET
 * when one is configured, so the limiter's key cannot be reversed into an
 * address, and falls back to a constant when there is no secret to hash with.
 */
export function callerKey(req, secret) {
  const raw = clientAddress(req);
  if (!secret) return 'anon';
  return createHash('sha256').update(String(secret)).update(raw).digest('base64url').slice(0, 32);
}
