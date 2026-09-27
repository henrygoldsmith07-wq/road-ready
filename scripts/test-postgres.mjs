import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  console.error("TEST_DATABASE_URL is required");
  process.exit(2);
}

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query("drop table if exists user_state cascade");
  await client.query("drop table if exists users cascade");

  const dir = join(process.cwd(), "database", "migrations");
  const migrations = (await readdir(dir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  if (!migrations.length) throw new Error("No database migrations found");

  // Apply the real migration chain twice: deployment retries must be harmless.
  for (let pass = 0; pass < 2; pass++) {
    for (const name of migrations) {
      await client.query(await readFile(join(dir, name), "utf8"));
    }
  }

  const user = await client.query(
    `insert into users (email, google_sub, name)
     values ('integration@example.com', 'google-sub-1', 'Integration')
     returning id`,
  );
  const userId = user.rows[0].id;

  const inserted = await client.query(
    `insert into user_state (user_id, payload, version, revision)
     values ($1, $2::jsonb, 1, 1)
     returning revision`,
    [userId, JSON.stringify({ bundle: "v1" })],
  );
  if (String(inserted.rows[0].revision) !== "1") throw new Error("initial revision is not 1");

  // This is the same compare-and-swap shape used by api/_lib/db.js.
  const update = async (expected, bundle) => client.query(
    `update user_state
        set payload = $2::jsonb, updated_at = now(), revision = revision + 1
      where user_id = $1 and revision = $3::bigint
      returning revision, payload`,
    [userId, JSON.stringify({ bundle }), String(expected)],
  );

  const staleBefore = await update(0, "stale-before");
  if (staleBefore.rowCount !== 0) throw new Error("stale revision unexpectedly overwrote state");

  const current = await update(1, "v2");
  if (current.rowCount !== 1 || String(current.rows[0].revision) !== "2") {
    throw new Error("current revision did not advance atomically");
  }

  const staleAfter = await update(1, "stale-after");
  if (staleAfter.rowCount !== 0) throw new Error("replayed revision unexpectedly overwrote newer state");

  const stored = await client.query("select payload, revision from user_state where user_id = $1", [userId]);
  if (stored.rows[0].payload.bundle !== "v2" || String(stored.rows[0].revision) !== "2") {
    throw new Error("stored state changed after a rejected stale write");
  }

  await client.query("delete from users where id = $1", [userId]);
  const remaining = await client.query("select count(*)::int as n from user_state where user_id = $1", [userId]);
  if (remaining.rows[0].n !== 0) throw new Error("user_state did not cascade-delete with the account");

  console.log(`postgres integration: PASS (${migrations.length} migrations, CAS + cascade verified)`);
} finally {
  await client.end();
}
