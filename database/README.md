# Database

Optional Postgres schema backing the optional account + sync feature. No
`DATABASE_URL`, no database — the app runs fully local-first.

## Applying migrations

`database/migrations/NNN_*.sql` files run in filename order, once each, via
your database tooling:

```bash
psql "$DATABASE_URL" -f database/migrations/001_accounts_and_sync.sql
psql "$DATABASE_URL" -f database/migrations/002_sync_revision.sql
```

Every statement is idempotent (`create table if not exists`,
`add column if not exists`), so re-running the whole chain is harmless — this
is verified in CI, where the `backend-postgres` job applies the chain twice
against a real Postgres 16 and then exercises the sync compare-and-swap and
cascade-delete behavior end to end (`scripts/test-postgres.mjs`).

## Rules for new migrations

1. **Never edit a migration that may already have run in production.** Add a
   new numbered migration that corrects forward.
2. Keep every statement idempotent and additive; destructive changes (drop /
   alter to stricter constraints) require a written, tested plan because the
   app must never end up writing rows the schema rejects.
3. New installs and upgraded installs must converge on the same final schema:
   a fresh install applies the whole chain; an upgraded one applies only new
   files. If both paths cannot reach identical schemas, the migration chain is
   wrong.
4. Constraints belong in the schema, not just the app: `users.email` is unique
   and lower-cased by check constraint; `user_state.user_id` is a primary key
   (one snapshot per account) and cascade-deletes with the account.

## Schema summary

- `users` — one row per Google account (matched by `google_sub`, linked by
  verified email; see `api/_lib/db.js`).
- `user_state` — one backup bundle per account (`payload` jsonb), a `version`
  for app-level snapshot migration, and `revision`, the server-enforced
  optimistic-concurrency token used by `PUT /api/sync`.
