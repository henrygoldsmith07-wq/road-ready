// Session tokens and id_token claim validation.
//
// These are the two places where a mistake means "anyone can sign in as
// anyone", so they get direct tests rather than being covered only through the
// HTTP handlers.

import { describe, expect, it } from 'vitest';

process.env.AUTH_SECRET = 'test-secret-not-a-real-one';
process.env.AUTH_GOOGLE_ID = 'test-client-id.apps.googleusercontent.com';
process.env.AUTH_GOOGLE_SECRET = 'test-client-secret';

const { issueSession, readSession } = await import('../api/_lib/session.js');
const { profileFromIdToken } = await import('../api/_lib/google.js');

import { createHmac } from 'node:crypto';



const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
/** A JWT with the given claims. The signature is never checked — see google.js. */
const idToken = (claims) => `${b64url({ alg: 'RS256' })}.${b64url(claims)}.signature`;

const validClaims = (overrides = {}) => ({
  iss: 'https://accounts.google.com',
  aud: 'test-client-id.apps.googleusercontent.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
  sub: '1234567890',
  email: 'person@example.com',
  email_verified: true,
  name: 'A Person',
  ...overrides,
});

describe('session tokens', () => {
  it('round-trips the user id it was issued for', () => {
    expect(readSession(issueSession('user-abc'))).toBe('user-abc');
  });

  it('rejects a token whose payload was altered', () => {
    const token = issueSession('user-abc');
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({
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
    const encoded = Buffer.from(JSON.stringify({ uid: 'u', iat: past - 10, exp: past }))
      .toString('base64url');
    // Sign it properly, so expiry is the only thing that can reject it.
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(encoded).digest('base64url');
    expect(readSession(`${encoded}.${signature}`)).toBe(null);
  });

  it('rejects garbage without throwing', () => {
    for (const bad of [undefined, null, '', 'nodot', 'a.b', '....', 42, {}]) {
      expect(readSession(bad)).toBe(null);
    }
  });
});

describe('id_token claim validation', () => {
  it('accepts a well-formed token from Google for this client', () => {
    const profile = profileFromIdToken(idToken(validClaims()));
    expect(profile.sub).toBe('1234567890');
    expect(profile.email).toBe('person@example.com');
    expect(profile.name).toBe('A Person');
  });

  it('refuses an unverified email — this is the account-takeover guard', () => {
    // Accounts link by email. Honouring an unverified address would let anyone
    // who can create a Google account with someone else's address take over
    // the account that address already owns.
    expect(() => profileFromIdToken(idToken(validClaims({ email_verified: false })))).toThrow(/not verified/i);
    expect(() => profileFromIdToken(idToken(validClaims({ email_verified: undefined })))).toThrow(/not verified/i);
  });

  it('refuses a token minted for a different client', () => {
    expect(() => profileFromIdToken(idToken(validClaims({ aud: 'someone-elses-client-id' })))).toThrow(/different client/i);
  });

  it('refuses an unexpected issuer', () => {
    expect(() => profileFromIdToken(idToken(validClaims({ iss: 'https://evil.example' })))).toThrow(/issuer/i);
  });

  it('refuses an expired token', () => {
    expect(() => profileFromIdToken(idToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 1 })))).toThrow(/expired/i);
  });

  it('refuses a token with no subject or no email', () => {
    expect(() => profileFromIdToken(idToken(validClaims({ sub: undefined })))).toThrow(/subject/i);
    expect(() => profileFromIdToken(idToken(validClaims({ email: undefined })))).toThrow(/email/i);
  });

  it('accepts an audience array that contains this client', () => {
    const profile = profileFromIdToken(
      idToken(validClaims({ aud: ['other-client', 'test-client-id.apps.googleusercontent.com'] })),
    );
    expect(profile.email).toBe('person@example.com');
  });
});
