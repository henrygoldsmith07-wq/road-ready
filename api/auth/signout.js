// Signing out invalidates the session on the server, then clears the cookie.
//
// It can never fail in a way that leaves someone signed in: the cookie is
// always cleared, even if the database is unreachable.
//
// Clearing the cookie alone was not enough. A session cookie is a
// self-contained signed token, so a leaked or cloned copy stayed valid for its
// full 30-day life — signing out of the browser that owned it did nothing to
// the copy. The account now records a revocation timestamp, and the routes
// refuse any token issued before it. This also gives "sign out everywhere"
// for free: one timestamp ends every session for the account.

import { clearSessionCookie, readCookies, readSessionPayload, SESSION_COOKIE } from '../_lib/session.js';
import { AccountsNotConfigured, isCrossOriginRequest } from '../_lib/config.js';
import { revokeSessions } from '../_lib/db.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end();
  }

  // A misconfigured deployment must not stop someone signing out. The origin
  // guard can fail with a configuration error (a broken AUTH_URL) rather than
  // a security verdict; either way the cookie is cleared, because leaving a
  // valid session cookie behind is the one outcome this route must not have.
  let refused = false;
  let misconfigured = false;
  try {
    refused = isCrossOriginRequest(req);
  } catch (error) {
    if (!(error instanceof AccountsNotConfigured)) throw error;
    console.error('[auth] sign-out origin check unavailable', error.message);
    misconfigured = true;
  }

  if (refused) {
    clearSessionCookie(res);
    return json(res, 403, { error: 'Cross-origin request refused' });
  }

  // Best effort: revoking the session must never block the sign-out itself.
  try {
    const session = readSessionPayload(readCookies(req)[SESSION_COOKIE]);
    if (session) {
      try {
        await revokeSessions(session.uid);
      } catch (error) {
        // A database that is down still lets the user sign out locally; the
        // stale token stays valid until it expires, which is the honest cost.
        console.error('[auth] could not revoke sessions on sign-out', error);
      }
    }
  } catch (error) {
    // Reading the session can fail (a missing AUTH_SECRET). The cookie is
    // still cleared, which is the point of this route.
    console.error('[auth] could not read session on sign-out', error);
  }

  clearSessionCookie(res);
  if (misconfigured) {
    return json(res, 503, { error: 'Accounts are not configured for this deployment.' });
  }
  return json(res, 200, { ok: true });
}
