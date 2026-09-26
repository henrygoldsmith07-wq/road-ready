// Cross-device sync for the signed-in account: one snapshot document per user.
//
// Whole-document replace with server-enforced optimistic concurrency. The
// server deliberately does not merge: it has no way to tell which of two study
// histories is correct, and a wrong merge silently corrupts weeks of practice.

import { DatabaseNotConfigured, deleteState, findUserById, readState, writeState } from './_lib/db.js';
import { MissingAuthSecret, readCookies, readSession, SESSION_COOKIE } from './_lib/session.js';

/** A full study history is well under this; past it is abuse, not use. */
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Mutating requests must be same-origin. The session cookie is SameSite=Lax,
 * which already stops cross-site POSTs carrying it; this refuses anything that
 * arrives with a foreign Origin as well.
 */
function crossOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function revisionToken(value) {
  if (value === null) return null;
  if (Number.isInteger(value) && value >= 1) return String(value);
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value;
  return undefined;
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
    const userId = readSession(readCookies(req)[SESSION_COOKIE]);
    if (!userId) return json(res, 401, { error: 'Not signed in' });
    // Resolve every time: a deleted account must not keep writing.
    const user = await findUserById(userId);
    if (!user) return json(res, 401, { error: 'Not signed in' });

    if (req.method === 'GET') {
      return json(res, 200, { state: await readState(user.id) });
    }

    if (req.method === 'PUT') {
      if (crossOrigin(req)) return json(res, 403, { error: 'Cross-origin request refused' });

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

      const version = Number.isInteger(body.version) ? body.version : 1;
      const written = await writeState(user.id, body.payload, version, expectedRevision, body.force === true);
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
      if (crossOrigin(req)) return json(res, 403, { error: 'Cross-origin request refused' });
      await deleteState(user.id);
      return json(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured || error instanceof MissingAuthSecret) {
      return json(res, 503, { error: error.message });
    }
    console.error('[sync] request failed', error);
    return json(res, 500, { error: 'Sync is unavailable' });
  }
}
