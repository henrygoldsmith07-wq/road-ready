// Session tokens, id_token verification, and OAuth flow-cookie encoding.
//
// These are the places where a mistake means "anyone can sign in as anyone",
// so they get direct tests rather than being covered only through the HTTP
// handlers.

import { describe, expect, it, beforeAll, vi } from 'vitest';
import { createHmac, createSign, generateKeyPairSync } from 'node:crypto';

process.env.AUTH_SECRET = 'test-secret-not-a-real-one';
process.env.AUTH_GOOGLE_ID = 'test-client-id.apps.googleusercontent.com';
process.env.AUTH_GOOGLE_SECRET = 'test-client-secret';

const { issueSession, readSession, encodeFlowValue, decodeFlowValue, SESSION_TOKEN_VERSION } =
  await import('../api/_lib/session.js');
const { verifyIdToken, resetJwksCache, createNonce } = await import('../api/_lib/google.js');
const { accountConfiguration, authOrigin } = await import('../api/_lib/config.js');

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// ---------------------------------------------------------------------------
// A real RSA key so the JWKS verification path is exercised end to end.
// ---------------------------------------------------------------------------
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = 'test-signing-key';
jwk.use = 'sig';
jwk.alg = 'RS256';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Installs a fake Google JWKS endpoint. */
function useJwks(keys) {
  globalThis.fetch = vi.fn(async (url) => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, json: async () => ({ keys }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

/** Signs real claims with the test RSA key, exactly as Google would. */
function signIdToken(claims, { kid = jwk.kid, alg = 'RS256' } = {}) {
  const header = b64url({ alg, kid, typ: 'JWT' });
  const payload = b64url(claims);
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
}

const validClaims = (overrides = {}) => ({
  iss: 'https://accounts.google.com',
  aud: 'test-client-id.apps.googleusercontent.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  sub: '1234567890',
  email: 'person@example.com',
  email_verified: true,
  name: 'A Person',
  ...overrides,
});

beforeAll(() => {
  resetJwksCache();
  useJwks([jwk]);
});

describe('session tokens', () => {
  it('round-trips the user id it was issued for', () => {
    expect(readSession(issueSession('user-abc'))).toBe('user-abc');
  });

  it('stamps the payload with the current token version', () => {
    const [payload] = issueSession('user-abc').split('.');
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).v).toBe(SESSION_TOKEN_VERSION);
  });

  it('rejects a token whose payload was altered', () => {
    const token = issueSession('user-abc');
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({
      v: SESSION_TOKEN_VERSION,
      uid: 'somebody-else',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url')}.${signature}`;
    expect(readSession(forged)).toBe(null);
  });

  it('rejects a token signed with a different secret', () => {
    const token = issueSession('user-abc');
    process.env.AUTH_SECRET = 'a-different-secret';
    expect(readSession(token)).toBe(null);
    process.env.AUTH_SECRET = 'test-secret-not-a-real-one';
  });

  it('rejects an expired token', () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const encoded = Buffer.from(JSON.stringify({ v: SESSION_TOKEN_VERSION, uid: 'u', iat: past - 10, exp: past }))
      .toString('base64url');
    // Sign it properly, so expiry is the only thing that can reject it.
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(encoded).digest('base64url');
    expect(readSession(`${encoded}.${signature}`)).toBe(null);
  });

  it('rejects a token with a future issued-at timestamp', () => {
    const now = Math.floor(Date.now() / 1000);
    const encoded = Buffer.from(JSON.stringify({ v: SESSION_TOKEN_VERSION, uid: 'u', iat: now + 3600, exp: now + 7200 }))
      .toString('base64url');
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(encoded).digest('base64url');
    expect(readSession(`${encoded}.${signature}`)).toBe(null);
  });

  it('rejects an expiry that outlives the maximum session lifetime', () => {
    const now = Math.floor(Date.now() / 1000);
    const year = 365 * 24 * 60 * 60;
    const encoded = Buffer.from(JSON.stringify({ v: SESSION_TOKEN_VERSION, uid: 'u', iat: now, exp: now + year }))
      .toString('base64url');
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(encoded).digest('base64url');
    expect(readSession(`${encoded}.${signature}`)).toBe(null);
  });

  it('rejects a token from an older payload version', () => {
    const now = Math.floor(Date.now() / 1000);
    const encoded = Buffer.from(JSON.stringify({ v: SESSION_TOKEN_VERSION - 1, uid: 'u', iat: now, exp: now + 3600 }))
      .toString('base64url');
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(encoded).digest('base64url');
    expect(readSession(`${encoded}.${signature}`)).toBe(null);
  });

  it('rejects garbage without throwing', () => {
    for (const bad of [undefined, null, '', 'nodot', 'a.b', '....', 42, {}]) {
      expect(readSession(bad)).toBe(null);
    }
  });
});

describe('id_token signature verification (JWKS)', () => {
  it('accepts a correctly signed token from Google for this client', async () => {
    const profile = await verifyIdToken(signIdToken(validClaims()));
    expect(profile.sub).toBe('1234567890');
    expect(profile.email).toBe('person@example.com');
    expect(profile.name).toBe('A Person');
  });

  it('refuses a token signed by a key Google never published', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const header = b64url({ alg: 'RS256', kid: jwk.kid });
    const payload = b64url(validClaims());
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const forged = `${header}.${payload}.${signer.sign(other.privateKey, 'base64url')}`;
    await expect(verifyIdToken(forged)).rejects.toThrow(/signature/i);
  });

  it('refuses a validly signed token whose key id is unknown', async () => {
    await expect(verifyIdToken(signIdToken(validClaims(), { kid: 'rotated-away-key' })))
      .rejects.toThrow(/unknown key/i);
  });

  it('refreshes the JWKS once when Google rotates keys', async () => {
    resetJwksCache();
    useJwks([jwk]);
    await verifyIdToken(signIdToken(validClaims())); // caches the key document
    // Google rotates: the served document now only has a new key...
    const rotated = { ...jwk, kid: 'new-key' };
    globalThis.fetch = vi.fn(async (url) => {
      if (url === JWKS_URL) return { ok: true, status: 200, json: async () => ({ keys: [rotated] }) };
      throw new Error(`unexpected fetch: ${url}`);
    });
    // ...and a token signed by that new key is accepted after one refresh.
    const profile = await verifyIdToken(signIdToken(validClaims(), { kid: 'new-key' }));
    expect(profile.email).toBe('person@example.com');
    resetJwksCache();
    useJwks([jwk]);
  });

  it('refuses anything that is not RS256', async () => {
    await expect(verifyIdToken(signIdToken(validClaims(), { alg: 'none' }))).rejects.toThrow(/RS256/i);
  });
});

describe('id_token claim validation', () => {
  it('refuses an unverified email — this is the account-takeover guard', async () => {
    // Accounts link by email. Honouring an unverified address would let anyone
    // who can create a Google account with someone else's address take over
    // the account that address already owns.
    await expect(verifyIdToken(signIdToken(validClaims({ email_verified: false })))).rejects.toThrow(/not verified/i);
    await expect(verifyIdToken(signIdToken(validClaims({ email_verified: undefined })))).rejects.toThrow(/not verified/i);
  });

  it('refuses a token minted for a different client', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({ aud: 'someone-elses-client-id' }))))
      .rejects.toThrow(/different client/i);
  });

  it('refuses an unexpected issuer', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({ iss: 'https://evil.example' })))).rejects.toThrow(/issuer/i);
  });

  it('refuses an expired token', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 1 }))))
      .rejects.toThrow(/expired/i);
  });

  it('refuses a token with a future issued-at time', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({ iat: Math.floor(Date.now() / 1000) + 3600 }))))
      .rejects.toThrow(/issued-at/i);
  });

  it('refuses a token with no subject or no email', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({ sub: undefined })))).rejects.toThrow(/subject/i);
    await expect(verifyIdToken(signIdToken(validClaims({ email: undefined })))).rejects.toThrow(/email/i);
  });

  it('accepts an audience array that contains this client with a matching azp', async () => {
    const profile = await verifyIdToken(signIdToken(validClaims({
      aud: ['other-client', 'test-client-id.apps.googleusercontent.com'],
      azp: 'test-client-id.apps.googleusercontent.com',
    })));
    expect(profile.email).toBe('person@example.com');
  });

  it('refuses a multi-audience token whose azp names another client', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({
      aud: ['other-client', 'test-client-id.apps.googleusercontent.com'],
      azp: 'other-client',
    }))).catch((e) => { throw e; })).rejects.toThrow(/azp/i);
  });
});

describe('OIDC nonce protection', () => {
  it('binds the expected nonce into the accepted token', async () => {
    const nonce = createNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const profile = await verifyIdToken(signIdToken(validClaims({ nonce })), { expectedNonce: nonce });
    expect(profile.email).toBe('person@example.com');
  });

  it('refuses a token whose nonce does not match the authorization request', async () => {
    await expect(verifyIdToken(signIdToken(validClaims({ nonce: 'attacker-chose-this' })), {
      expectedNonce: 'server-expected-value',
    })).rejects.toThrow(/nonce/i);
  });

  it('refuses a token with no nonce when one was expected', async () => {
    await expect(verifyIdToken(signIdToken(validClaims()), { expectedNonce: 'server-expected-value' }))
      .rejects.toThrow(/nonce/i);
  });
});

describe('OAuth flow cookie encoding', () => {
  it('round-trips the flow payload as an RFC 6265-safe value', () => {
    const raw = encodeFlowValue({ state: 's=1; x', verifier: 'v?/#', nonce: 'n +1' });
    // base64url alphabet only — safe as a bare cookie value.
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeFlowValue(raw)).toEqual({ state: 's=1; x', verifier: 'v?/#', nonce: 'n +1' });
  });

  it('throws on malformed payloads instead of returning junk', () => {
    expect(() => decodeFlowValue('not base64url!!')).toThrow();
    expect(() => decodeFlowValue('')).toThrow();
    expect(() => decodeFlowValue(Buffer.from('[1,2,3]').toString('base64url'))).toThrow();
  });

  it('no longer stores raw JSON in the cookie value', () => {
    const raw = encodeFlowValue({ state: 'abc' });
    expect(raw.startsWith('{')).toBe(false);
    expect(raw.includes('"')).toBe(false);
  });
});

describe('account deployment configuration', () => {
  it('requires the complete account stack, not only Google credentials', () => {
    const previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
      AUTH_URL: process.env.AUTH_URL,
    };
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'test';
    expect(accountConfiguration().configured).toBe(false);
    process.env.DATABASE_URL = 'postgres://example.invalid/db';
    expect(accountConfiguration().configured).toBe(true);
    if (previous.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.DATABASE_URL;
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.AUTH_URL === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previous.AUTH_URL;
  });

  it('requires canonical AUTH_URL in production instead of trusting Host', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAuthUrl = process.env.AUTH_URL;
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_URL;
    expect(() => authOrigin({ headers: { host: 'attacker.example' } })).toThrow(/AUTH_URL/i);
    process.env.AUTH_URL = 'https://road-ready.example/';
    expect(authOrigin({ headers: { host: 'attacker.example' } })).toBe('https://road-ready.example');
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAuthUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previousAuthUrl;
  });
});
