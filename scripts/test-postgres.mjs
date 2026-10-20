import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import {
  deleteUser,
  findUserById,
  readState,
  setQueryExecutor,
  upsertGoogleUser,
  writeState,
} from "../api/_lib/db.js";

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

  // From here on every statement is the production SQL in api/_lib/db.js,
  // routed through this client instead of Neon's HTTP driver.
  setQueryExecutor((text, params) => client.query(text, params).then((r) => r.rows));
  const expect = (ok, message) => { if (!ok) throw new Error(message); };

  /* ---------- account resolution ---------- */
  const user = await upsertGoogleUser({ sub: "google-sub-1", email: "Integration@Example.com", name: "Integration" });
  expect(user.email === "integration@example.com", "email was not normalised to lower case");
  const userId = user.id;

  const again = await upsertGoogleUser({ sub: "google-sub-1", email: "integration@example.com", name: null });
  expect(again.id === userId && again.name === "Integration", "a repeat sign-in did not resolve the same account");

  // The holder changes the address on their Google account: same sub, new email.
  const moved = await upsertGoogleUser({ sub: "google-sub-1", email: "moved@example.com" });
  expect(moved.id === userId && moved.email === "moved@example.com", "the stored email did not follow the Google account");

  // A legacy row with no Google subject yet links by verified email.
  const legacy = await client.query("insert into users (email) values ('legacy@example.com') returning id");
  const linkedLegacy = await upsertGoogleUser({ sub: "google-sub-legacy", email: "legacy@example.com" });
  expect(linkedLegacy.id === legacy.rows[0].id && linkedLegacy.google_sub === "google-sub-legacy", "a legacy row was not linked by email");

  // A reassigned address arriving with a different sub must not inherit the account.
  let refused = false;
  try {
    await upsertGoogleUser({ sub: "google-sub-intruder", email: "moved@example.com" });
  } catch {
    refused = true;
  }
  expect(refused, "a different Google subject took over an account by email");
  const owner = await findUserById(userId);
  expect(owner.google_sub === "google-sub-1", "the existing account's Google subject was overwritten");

  // Moving to an address another account holds keeps the old one rather than failing.
  const blocked = await upsertGoogleUser({ sub: "google-sub-1", email: "legacy@example.com" });
  expect(blocked.id === userId && blocked.email === "moved@example.com", "an email change collided with another account");

  /* ---------- sync snapshot compare-and-swap ---------- */
  const first = await writeState(userId, { bundle: "v1" }, 1, null);
  expect(first && String(first.revision) === "1", "initial revision is not 1");
  expect((await writeState(userId, { bundle: "dup" }, 1, null)) === null, "a create overwrote an existing snapshot");

  expect((await writeState(userId, { bundle: "stale-before" }, 1, "0")) === null, "stale revision unexpectedly overwrote state");
  const current = await writeState(userId, { bundle: "v2" }, 1, "1");
  expect(current && String(current.revision) === "2", "current revision did not advance atomically");
  expect((await writeState(userId, { bundle: "stale-after" }, 1, "1")) === null, "replayed revision unexpectedly overwrote newer state");

  const stored = await readState(userId);
  expect(stored.payload.bundle === "v2" && String(stored.revision) === "2", "stored state changed after a rejected stale write");

  await deleteUser(userId);
  expect((await readState(userId)) === null, "user_state did not cascade-delete with the account");

  console.log(`postgres integration: PASS (${migrations.length} migrations, account linking + CAS + cascade verified)`);
} finally {
  await client.end();
}
