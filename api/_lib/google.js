// Google OAuth 2.0 (OIDC) — authorization-code flow with PKCE and nonce.
//
// Written directly against Google's endpoints rather than through a library:
// this app needs identity and nothing else, and the flow is small enough that
// having it visible is worth more than the abstraction.
//
// Things here that are load-bearing and easy to get wrong:
//
//  1. `state` is checked against a cookie this server set. Without it, an
//     attacker can complete the flow in a victim's browser with their own code
//     and sign the victim into the attacker's account (login CSRF).
//  2. The id_token's RSA signature is verified against Google's published JWKS
//     keys. Verifying signature + issuer + audience + expiry + email_verified
//     means the only thing this server trusts is a token Google actually
//     minted for this client about a human who proved control of the address.
//  3. The `nonce` bound into the authorization request must be present in the
//     returned id_token, so a token minted during some other flow (or replayed
//     from one) cannot be exchanged into a session here.

import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { randomToken } from './session.js';
import { authOrigin } from './config.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
// Google rotates JWKS keys; cache them briefly and re-fetch on an unknown kid
// (the documented rotation pattern) rather than on every sign-in.
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
// Google id_tokens live about an hour; tolerate small clock skew.
const CLOCK_SKEW_SECONDS = 60;

export class GoogleNotConfigured extends Error {
  constructor() {
    super(
      'Google sign-in is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, ' +
        'and add this deployment\'s /api/auth/callback URL to the OAuth client.',
    );
    this.name = 'GoogleNotConfigured';
  }
}

export function isGoogleConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

function credentials() {
  if (!isGoogleConfigured()) throw new GoogleNotConfigured();
  return {
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  };
}

/**
 * Where Google sends the browser back. Derived from the request so a preview
 * deployment works without extra configuration, but AUTH_URL wins when set —
 * needed when a proxy rewrites the host.
 */
export function callbackUrl(req) {
  return `${authOrigin(req)}/api/auth/callback`;
}

/** PKCE: a high-entropy verifier and its S256 challenge. */
export function createPkce() {
  const verifier = randomToken();
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** OIDC nonce: a distinct high-entropy value bound into the id_token. */
export const createNonce = randomToken;

export function authorizationUrl({ redirectUri, state, challenge, nonce }) {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // Identity only — no API scope, so no refresh token is requested either.
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchanges the code for tokens. Throws when Google rejects the exchange. */
export async function exchangeCode({ code, redirectUri, verifier }) {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google rejected the code exchange (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response.json();
}

/** Decodes a JWT's parts without trusting any of them — verification happens after. */
function decodeSignedToken(idToken) {
  const parts = String(idToken).split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error('Malformed id_token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  return { header, claims, signingInput: `${parts[0]}.${parts[1]}`, signature: parts[2] };
}

let jwksCache = { keys: null, fetchedAt: 0 };
/** Test seam: reset the JWKS cache between cases. */
export function resetJwksCache() {
  jwksCache = { keys: null, fetchedAt: 0 };
}

async function fetchJwks() {
  const fresh = jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS;
  if (fresh) return jwksCache.keys;
  const response = await fetch(JWKS_ENDPOINT, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Could not load Google's signing keys (${response.status})`);
  const body = await response.json();
  if (!Array.isArray(body.keys) || !body.keys.length) throw new Error("Google's signing keys document is malformed");
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return jwksCache.keys;
}

/**
 * Verifies the id_token's RS256 signature against Google's published JWKS
 * keys and returns the claims. Throws on any mismatch: this is the boundary
 * between "some bytes" and "a token Google actually minted".
 */
async function verifySignatureAndClaims(idToken) {
  const { header, claims, signingInput, signature } = decodeSignedToken(idToken);
  if (header.alg !== 'RS256') throw new Error('id_token must be signed with RS256');
  if (!header.kid) throw new Error('id_token carries no key id');

  let keys = await fetchJwks();
  let matching = keys.filter((k) => k.kid === header.kid);
  if (!matching.length) {
    // Unknown kid: Google rotated keys — force one refresh before giving up.
    jwksCache = { keys: null, fetchedAt: 0 };
    keys = await fetchJwks();
    matching = keys.filter((k) => k.kid === header.kid);
  }
  const jwk = matching[0];
  if (!jwk || (jwk.use && jwk.use !== 'sig') || (jwk.kty && jwk.kty !== 'RSA')) {
    throw new Error('id_token was signed with an unknown key');
  }

  const ok = verifySignature(
    'RSA-SHA256',
    Buffer.from(signingInput),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(signature, 'base64url'),
  );
  if (!ok) throw new Error('id_token signature is invalid');
  return claims;
}

/**
 * Verifies the id_token end to end (signature, issuer, audience, expiry,
 * subject, verified email, nonce) and returns the profile it asserts.
 * Every rejection here is a refusal to sign anyone in.
 */
export async function verifyIdToken(idToken, { expectedNonce } = {}) {
  const { clientId } = credentials();
  const claims = await verifySignatureAndClaims(idToken);

  if (!VALID_ISSUERS.has(claims.iss)) throw new Error('id_token has an unexpected issuer');
  // The audience must be THIS client — a token minted for another application
  // is not evidence that this user meant to sign in here.
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) throw new Error('id_token was issued for a different client');
  // When aud lists multiple audiences, OIDC requires azp to name this client.
  if (audience.length > 1 && claims.azp !== clientId) {
    throw new Error('id_token azp does not match this client');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    throw new Error('id_token has expired');
  }
  // A token minted in the future is malformed or replayed — refuse it.
  if (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_SKEW_SECONDS) {
    throw new Error('id_token has an invalid issued-at time');
  }
  if (!claims.sub) throw new Error('id_token carries no subject');
  if (!claims.email) throw new Error('id_token carries no email');
  // Accounts link by email, so an unverified address is a takeover vector.
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new Error('Google has not verified this email address');
  }
  // Nonce: ties this exact id_token to the authorization request this server
  // started, defending against token injection and replay across flows.
  if (expectedNonce) {
    if (typeof claims.nonce !== 'string' || claims.nonce !== expectedNonce) {
      throw new Error('id_token nonce does not match the authorization request');
    }
  }

  return {
    sub: String(claims.sub),
    email: String(claims.email),
    name: typeof claims.name === 'string' ? claims.name : null,
    image: typeof claims.picture === 'string' ? claims.picture : null,
  };
}
