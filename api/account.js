// Signed-in account lifecycle. Deleting an account removes the users row and,
// via ON DELETE CASCADE, its synced snapshot. Local browser progress is not
// touched.

import { DatabaseNotConfigured, deleteUser, findUserById } from './_lib/db.js';
import {
  clearSessionCookie,
  MissingAuthSecret,
  readCookies,
  readSessionPayload,
  SESSION_COOKIE,
} from './_lib/session.js';
import { AccountsNotConfigured, isCrossOriginRequest } from './_lib/config.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (isCrossOriginRequest(req)) return json(res, 403, { error: 'Cross-origin request refused' });

  try {
    const session = readSessionPayload(readCookies(req)[SESSION_COOKIE]);
    if (!session) return json(res, 401, { error: 'Not signed in' });
    const user = await findUserById(session.uid);
    if (!user) {
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    }
    // A session revoked on the server cannot delete the account it belongs to.
    if (user.revoked_before) {
      const revokedAt = new Date(user.revoked_before).getTime() / 1000;
      if (!Number.isFinite(revokedAt) || session.iat < revokedAt) {
        return json(res, 401, { error: 'Not signed in' });
      }
    }

    await deleteUser(user.id);
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof DatabaseNotConfigured || error instanceof MissingAuthSecret
        || error instanceof AccountsNotConfigured) {
      // The detail names the missing environment variable. Useful to an
      // operator, informative to an unauthenticated caller — so the client
      // gets a generic message and the detail stays in the log.
      console.error('[account] not configured', error.message);
      return json(res, 503, { error: 'Accounts are not configured for this deployment.' });
    }
    console.error('[account] delete failed', error);
    return json(res, 500, { error: 'Could not delete account' });
  }
}
