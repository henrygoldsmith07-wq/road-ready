// Postgres access for accounts and sync.
//
// The database is optional: with no DATABASE_URL the app runs exactly as it
// always has — local-first in browser storage, no accounts, nothing server-side.
// Every helper throws DatabaseNotConfigured, which the routes turn into a
// clear 503 rather than a stack trace.

import { neon } from '@neondatabase/serverless';

export class DatabaseNotConfigured extends Error {
  constructor() {
    super(
      'Accounts are not configured for this deployment. Set DATABASE_URL to a ' +
        'pooled Postgres connection string to enable sign-in and sync.',
    );
    this.name = 'DatabaseNotConfigured';
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

let client = null;

function sql() {
  const url = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
  if (!url) throw new DatabaseNotConfigured();
  // Connect lazily so importing this module never opens a connection.
  if (!client) client = neon(url);
  return client;
}

// Test seam: route queries through another Postgres client (the integration
// test runs these exact statements through node-postgres). null restores Neon.
let executor = null;
export function setQueryExecutor(fn) {
  executor = fn;
}

export async function queryRows(text, params = []) {
  if (executor) return executor(text, params);
  return sql().query(text, params);
}

/**
 * Resolves the app user behind a verified Google profile, creating or linking
 * one as needed.
 *
 * Matching is by google_sub first — it survives the user changing the address
 * on their Google account, and the stored email follows the change unless
 * another account already holds the new address. Email is only a link key for
 * a row that has never been bound to a Google subject: Google reassigns
 * addresses (Workspace accounts especially), so a verified email arriving with
 * a different sub is a different person and must not inherit the account.
 * That case resolves no row and the sign-in is refused.
 *
 * One statement, so two concurrent first sign-ins cannot both insert.
 */
export async function upsertGoogleUser(profile) {
  const email = String(profile.email).trim().toLowerCase();
  const rows = await queryRows(
    `WITH linked AS (
       UPDATE users
          SET email = CASE
                WHEN EXISTS (SELECT 1 FROM users other
                              WHERE other.email = $1 AND other.google_sub IS DISTINCT FROM $2)
                THEN users.email ELSE $1 END,
              name = COALESCE($3, name),
              image = COALESCE($4, image)
        WHERE google_sub = $2
        RETURNING *
     ), inserted AS (
       INSERT INTO users (email, google_sub, name, image)
       SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM linked)
       ON CONFLICT (email) DO UPDATE
          SET google_sub = EXCLUDED.google_sub,
              name = COALESCE(users.name, EXCLUDED.name),
              image = COALESCE(users.image, EXCLUDED.image)
        WHERE users.google_sub IS NULL
       RETURNING *
     )
     SELECT * FROM linked
     UNION ALL
     SELECT * FROM inserted`,
    [email, profile.sub, profile.name ?? null, profile.image ?? null],
  );
  if (!rows[0]) {
    // Two concurrent first sign-ins for the same Google account: the first
    // inserts, the second's insert conflicts and its ON CONFLICT DO UPDATE
    // no longer matches (google_sub is no longer NULL). That is a benign race,
    // not an account-takeover attempt — so re-read by subject and let the
    // caller proceed. Only a row that is genuinely bound to a DIFFERENT
    // subject is refused.
    const raced = await queryRows('select * from users where google_sub = $1', [profile.sub]);
    if (raced[0]) return raced[0];
    throw new Error('This email belongs to an account linked to a different Google sign-in');
  }
  return rows[0];
}

export async function findUserById(id) {
  const rows = await queryRows('select * from users where id = $1', [id]);
  return rows[0] ?? null;
}

export async function readState(userId) {
  const rows = await queryRows(
    'select payload, updated_at, version, revision from user_state where user_id = $1',
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Just the snapshot's timestamp and revision — no payload.
 *
 * The client polls this to show "last saved ...". Reading the full payload
 * for that shipped the entire (up to 4 MB) backup bundle over the wire on
 * every Settings open, to read two columns.
 */
export async function readStateMeta(userId) {
  const rows = await queryRows(
    'select updated_at, revision from user_state where user_id = $1',
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Invalidates every session for this account.
 *
 * A session cookie is a self-contained signed token, so clearing the cookie
 * in the browser was the only thing signing out did — a leaked or cloned
 * cookie kept working for its full 30-day life. Marking the account as
 * revoked from this moment lets the routes refuse any token issued earlier.
 */
export async function revokeSessions(userId) {
  await queryRows('update users set revoked_before = now() where id = $1', [userId]);
}

/**
 * Replaces this account's snapshot using optimistic concurrency.
 *
 * expectedRevision is the exact revision the client last observed. A normal
 * write succeeds only if that revision is still current; the check and write
 * happen in one database statement, so two devices cannot both pass it.
 */
export async function writeState(userId, payload, version, expectedRevision) {
  const encoded = JSON.stringify(payload);
  let rows;

  if (expectedRevision == null) {
    // The client believes no remote snapshot exists. Do not overwrite one that
    // appeared after its read.
    rows = await queryRows(
      `insert into user_state (user_id, payload, version, updated_at, revision)
       values ($1, $2, $3, now(), 1)
       on conflict (user_id) do nothing
       returning updated_at, revision`,
      [userId, encoded, version],
    );
    return rows[0] ?? null;
  }

  rows = await queryRows(
    `update user_state
        set payload = $2, version = $3, updated_at = now(), revision = revision + 1
      where user_id = $1 and revision = $4::bigint
      returning updated_at, revision`,
    [userId, encoded, version, String(expectedRevision)],
  );
  return rows[0] ?? null;
}

export async function deleteState(userId) {
  await queryRows('delete from user_state where user_id = $1', [userId]);
}

/** Deletes the account row; user_state is removed by ON DELETE CASCADE. */
export async function deleteUser(userId) {
  await queryRows('delete from users where id = $1', [userId]);
}
