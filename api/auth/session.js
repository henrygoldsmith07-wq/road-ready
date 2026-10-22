// Who is signed in? Answers `{ user: null }` when nobody is — being signed out
// is a normal state, not an error the client has to special-case.

import { DatabaseNotConfigured, findUserById } from '../_lib/db.js';
import { MissingAuthSecret, readCookies, readSessionPayload, SESSION_COOKIE } from '../_lib/session.js';
import { isAccountsConfigured } from '../_lib/config.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // `available` lets the UI hide sign-in entirely on a deployment that has no
  // accounts configured, rather than offering a button that cannot work.
  const available = isAccountsConfigured();

  try {
    const session = readSessionPayload(readCookies(req)[SESSION_COOKIE]);
    if (!session) return res.end(JSON.stringify({ available, user: null }));

    // The token outlives the row it names, so resolve it every time: a deleted
    // account must stop working at once.
    const user = await findUserById(session.uid);
    if (!user) return res.end(JSON.stringify({ available, user: null }));

    // A session revoked on the server is not signed in, even though its token
    // is still cryptographically valid. Reporting otherwise would leave the
    // account panel showing "signed in" while every sync call is refused.
    if (user.revoked_before) {
      const revokedAt = new Date(user.revoked_before).getTime() / 1000;
      if (!Number.isFinite(revokedAt) || session.iat < revokedAt) {
        return res.end(JSON.stringify({ available, user: null }));
      }
    }

    return res.end(JSON.stringify({
      available,
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
    }));
  } catch (error) {
    if (error instanceof DatabaseNotConfigured || error instanceof MissingAuthSecret) {
      return res.end(JSON.stringify({ available: false, user: null }));
    }
    console.error('[auth] session lookup failed', error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ available, user: null, error: 'Session lookup failed' }));
  }
}
