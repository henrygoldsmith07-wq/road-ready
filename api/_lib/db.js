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

export async function queryRows(text, params = []) {
  return sql().query(text, params);
}

/**
 * Resolves the app user behind a verified Google profile, creating or linking
 * one as needed.
 *
 * Matching is by google_sub first — it survives the user changing the address
 * on their Google account — then by email. Email is only trusted as a link key
 * because the caller has already verified Google marked it verified.
 *
 * One statement, so two concurrent first sign-ins cannot both insert.
 */
export async function upsertGoogleUser(profile) {
  const email = String(profile.email).trim().toLowerCase();
  const rows = await queryRows(
    `WITH linked AS (
       UPDATE users SET name = COALESCE($3, name), image = COALESCE($4, image)
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
       RETURNING *
     )
     SELECT * FROM linked
     UNION ALL
     SELECT * FROM inserted`,
    [email, profile.sub, profile.name ?? null, profile.image ?? null],
  );
  if (!rows[0]) throw new Error('Could not resolve a Google account');
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
 * Replaces this account's snapshot using optimistic concurrency.
 *
 * expectedRevision is the exact revision the client last observed. A normal
 * write succeeds only if that revision is still current; the check and write
 * happen in one database statement, so two devices cannot both pass it.
 * `force` is reserved for an explicit user-confirmed overwrite.
 */
export async function writeState(userId, payload, version, expectedRevision, force = false) {
  const encoded = JSON.stringify(payload);
  let rows;

  if (force) {
    rows = await queryRows(
      `insert into user_state (user_id, payload, version, updated_at, revision)
       values ($1, $2, $3, now(), 1)
       on conflict (user_id) do update
         set payload = excluded.payload,
             version = excluded.version,
             updated_at = now(),
             revision = user_state.revision + 1
       returning updated_at, revision`,
      [userId, encoded, version],
    );
    return rows[0] ?? null;
  }

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
