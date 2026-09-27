// Signing out clears the session cookie. It can never fail: there is no server
// record to delete, and leaving someone signed in because a database was down
// would be the worst possible outcome here.

import { clearSessionCookie } from '../_lib/session.js';
import { isCrossOriginRequest } from '../_lib/config.js';

export default function handler(req, res) {
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
  clearSessionCookie(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: true }));
}
