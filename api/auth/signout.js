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
import { isCrossOriginRequest } from '../_lib/config.js';
import { revokeSessions } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end();
  }
  if (isCrossOriginRequest(req)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ error: 'Cross-origin request refused' }));
  }

  // Best effort: revoking the session must never block the sign-out itself.
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

  clearSessionCookie(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: true }));
}
