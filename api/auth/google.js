// Starts Google sign-in: mints state + PKCE, stores them in a short-lived
// cookie, and redirects to Google's consent screen.

import {
  authorizationUrl,
  callbackUrl,
  createNonce,
  createPkce,
  GoogleNotConfigured,
} from '../_lib/google.js';
import { encodeFlowValue, MissingAuthSecret, randomToken, setFlowCookie } from '../_lib/session.js';
import { AccountsNotConfigured, requireAccountsConfigured } from '../_lib/config.js';

export const FLOW_COOKIE = 'roadready_oauth_flow';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  try {
    requireAccountsConfigured();

    const state = randomToken();
    const nonce = createNonce();
    const { verifier, challenge } = createPkce();
    // State, PKCE verifier and OIDC nonce live in an httpOnly cookie, never
    // in the URL or in server memory: the callback may well be served by a
    // different instance. The value is base64url-encoded JSON so the cookie
    // carries only RFC 6265-safe characters.
    setFlowCookie(res, FLOW_COOKIE, encodeFlowValue({ state, verifier, nonce }));

    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', authorizationUrl({
      redirectUri: callbackUrl(req),
      state,
      challenge,
      nonce,
    }));
    res.end();
  } catch (error) {
    const known = error instanceof GoogleNotConfigured || error instanceof MissingAuthSecret
      || error instanceof AccountsNotConfigured;
    res.statusCode = known ? 503 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: known ? error.message : 'Could not start sign-in' }));
    if (!known) console.error('[auth] failed to start Google sign-in', error);
  }
}
