// Signed-in account lifecycle. Deleting an account removes the users row and,
// via ON DELETE CASCADE, its synced snapshot. Local browser progress is not
// touched.

import { DatabaseNotConfigured, deleteUser, findUserById } from './_lib/db.js';
import {
  clearSessionCookie,
  MissingAuthSecret,
  readCookies,
  readSession,
  SESSION_COOKIE,
} from './_lib/session.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

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

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (crossOrigin(req)) return json(res, 403, { error: 'Cross-origin request refused' });

  try {
    const userId = readSession(readCookies(req)[SESSION_COOKIE]);
    if (!userId) return json(res, 401, { error: 'Not signed in' });
    const user = await findUserById(userId);
    if (!user) {
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    }

    await deleteUser(user.id);
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured || error instanceof MissingAuthSecret) {
      return json(res, 503, { error: error.message });
    }
    console.error('[account] delete failed', error);
    return json(res, 500, { error: 'Could not delete account' });
  }
}
