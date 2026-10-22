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
import { callerKey, hit } from '../_lib/ratelimit.js';

export const FLOW_COOKIE = 'roadready_oauth_flow';

/** Starting a sign-in mints a nonce and a PKCE pair, so it is rate limited. */
const SIGNIN_LIMIT = 10;
const SIGNIN_WINDOW_MS = 60_000;

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

    const key = callerKey(req, process.env.AUTH_SECRET);
    const limit = hit(`${key}:signin`, SIGNIN_LIMIT, SIGNIN_WINDOW_MS);
    if (!limit.allowed) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.end(JSON.stringify({ error: 'Too many sign-in attempts. Try again shortly.' }));
    }

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
    // A configuration message names the missing environment variable, which
    // tells an unauthenticated caller how this deployment is set up. The
    // detail goes to the log; the client gets a generic message.
    if (known) console.error('[auth] sign-in is not configured', error.message);
    res.end(JSON.stringify({
      error: known ? 'Sign-in is not available on this deployment.' : 'Could not start sign-in',
    }));
    if (!known) console.error('[auth] failed to start Google sign-in', error);
  }
}
