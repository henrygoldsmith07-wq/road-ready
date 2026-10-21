// Cross-device sync for the signed-in account: one snapshot document per user.
//
// Whole-document replace with server-enforced optimistic concurrency. The
// server deliberately does not merge: it has no way to tell which of two study
// histories is correct, and a wrong merge silently corrupts weeks of practice.

import { DatabaseNotConfigured, deleteState, findUserById, readState, readStateMeta, writeState } from './_lib/db.js';
import { MissingAuthSecret, readCookies, readSessionPayload, SESSION_COOKIE } from './_lib/session.js';
import { isCrossOriginRequest } from './_lib/config.js';
import { callerKey, hit } from './_lib/ratelimit.js';

/** A full study history is well under this; past it is abuse, not use. */
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

/** Writes are the expensive operation: each one is a real database round trip. */
const WRITE_LIMIT = 20;      // per window
const READ_LIMIT = 60;       // per window
const LIMIT_WINDOW_MS = 60_000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * A revision token, or undefined when the value is not a usable one.
 *
 * The bound matters: the value is cast to a Postgres bigint, and
 * `Number.isInteger(1e300)` is true, so an unbounded number reached the
 * database as a cast failure — a 500 for what is plainly a bad request.
 * Exponent notation and absurd digit counts are refused here instead.
 */
function revisionToken(value) {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || !Number.isSafeInteger(value)) return undefined;
    return String(value);
  }
  if (typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return undefined;
    return String(parsed);
  }
  return undefined;
}

/** The snapshot format version. Bounded so a nonsense value cannot reach an int column. */
function payloadVersion(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) return 1;
  return parsed;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // Stop reading rather than buffering an unbounded upload.
    if (size > MAX_PAYLOAD_BYTES) throw new Error('too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  try {
    const session = readSessionPayload(readCookies(req)[SESSION_COOKIE]);
    if (!session) return json(res, 401, { error: 'Not signed in' });
    // Resolve every time: a deleted account must not keep writing.
    const user = await findUserById(session.uid);
    if (!user) return json(res, 401, { error: 'Not signed in' });
    // A session revoked on the server (signed out, or signed out everywhere)
    // stops working even though its token is still cryptographically valid.
    if (user.revoked_before) {
      const revokedAt = new Date(user.revoked_before).getTime() / 1000;
      if (!Number.isFinite(revokedAt) || session.iat < revokedAt) {
        return json(res, 401, { error: 'Not signed in' });
      }
    }

    const key = callerKey(req, process.env.AUTH_SECRET);

    if (req.method === 'GET') {
      const limit = hit(`${key}:read`, READ_LIMIT, LIMIT_WINDOW_MS);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        return json(res, 429, { error: 'Too many requests' });
      }
      // ?meta=1 asks for the snapshot's timestamp and revision only. The
      // client polls those two columns to show "last saved ..."; fetching the
      // whole backup bundle for that shipped up to 4 MB on every poll.
      const wantsMeta = String(req.url || '').includes('meta=1');
      if (wantsMeta) {
        const meta = await readStateMeta(user.id);
        return json(res, 200, {
          state: meta ? { updated_at: meta.updated_at, revision: meta.revision } : null,
        });
      }
      return json(res, 200, { state: await readState(user.id) });
    }

    if (req.method === 'PUT') {
      if (isCrossOriginRequest(req)) return json(res, 403, { error: 'Cross-origin request refused' });
      const limit = hit(`${key}:write`, WRITE_LIMIT, LIMIT_WINDOW_MS);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        return json(res, 429, { error: 'Too many requests' });
      }
      // Cheap rejection of non-JSON uploads before buffering the body.
      const contentType = String(req.headers['content-type'] || '');
      if (!contentType.includes('application/json')) {
        return json(res, 415, { error: 'Content-Type must be application/json' });
      }

      let raw;
      try {
        raw = await readBody(req);
      } catch {
        return json(res, 413, { error: 'Snapshot too large' });
      }

      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'A JSON object body is required' });
      }
      // The payload is the app's own backup bundle, as a JSON string. Checking
      // the shape keeps anything else out of the column.
      if (!body || typeof body.payload !== 'object' || body.payload === null
        || typeof body.payload.bundle !== 'string') {
        return json(res, 400, { error: 'payload must carry a backup bundle' });
      }

      if (!Object.prototype.hasOwnProperty.call(body, 'expectedRevision')) {
        return json(res, 400, { error: 'expectedRevision is required' });
      }
      const expectedRevision = revisionToken(body.expectedRevision);
      if (expectedRevision === undefined) {
        return json(res, 400, { error: 'expectedRevision must be null or a positive revision' });
      }

      const version = payloadVersion(body.version);
      const written = await writeState(user.id, body.payload, version, expectedRevision);
      if (!written) {
        const current = await readState(user.id);
        return json(res, 409, {
          error: 'The synced copy changed on another device',
          updated_at: current ? current.updated_at : null,
          revision: current ? current.revision : null,
        });
      }
      return json(res, 200, { updated_at: written.updated_at, revision: written.revision });
    }

    if (req.method === 'DELETE') {
      if (isCrossOriginRequest(req)) return json(res, 403, { error: 'Cross-origin request refused' });
      await deleteState(user.id);
      return json(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured || error instanceof MissingAuthSecret) {
      // The detail names the missing environment variable. That is useful to
      // an operator and tells an unauthenticated caller exactly how this
      // deployment is configured, so the client gets a generic message and
      // the detail stays in the log.
      console.error('[sync] not configured', error.message);
      return json(res, 503, { error: 'Sync is not configured for this deployment.' });
    }
    console.error('[sync] request failed', error);
    return json(res, 500, { error: 'Sync is unavailable' });
  }
}
