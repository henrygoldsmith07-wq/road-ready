# Deploying Road Ready

## What ships where

| Piece | Target | Notes |
| --- | --- | --- |
| Static app (`index.html`, `js/`, `css/`, `sw.js`, PWA assets) | Vercel (or any static host) | Zero build step — what is in the repo is what is deployed |
| Serverless API (`api/*.js`) | Vercel Functions | Only used when the optional account feature is configured |
| Postgres | Neon (pooled connection string) | Only for accounts + sync |

Security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`) are set in `vercel.json`. `serve.js` serves the same policy locally so E2E and Lighthouse runs exercise the real thing — if you change one, change both (a contract test enforces this: `tests/security-headers.test.js`).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | accounts only | Pooled Postgres connection string |
| `AUTH_SECRET` | accounts only | Session signing key — generate with `openssl rand -base64 32`. Production refuses keys shorter than 32 characters. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | accounts only | Google OAuth client (redirect: `https://<your-domain>/api/auth/callback`) |
| `AUTH_URL` | accounts, production | Canonical origin. Production **requires** it so a spoofed `Host` header can never steer the OAuth redirect. |

No accounts configured? Deploy the static app as-is — sign-in never appears and the PWA works fully offline.

## Before promoting a commit to production

1. CI must be green on the exact commit being deployed: lint, typecheck, service-worker version check, production dependency audit, unit + content + hygiene tests, Postgres integration, E2E on all three projects, Lighthouse.
2. Configure branch protection on `main` to require the CI checks (Settings → Branches). Suggested minimum: require `lint-and-typecheck`, `unit-and-content`, `audit`, `backend-postgres`, `e2e`, and `lighthouse`; require at least one review; disallow force pushes.
3. Prefer deploying from the `main` branch only (Vercel: Production Branch = `main`). A broken commit that cannot reach `main` cannot silently become production.

## Service worker & cache versioning

`sw.js`'s `VERSION` is **generated** — a content hash of every precached shell file, produced by `scripts/update-sw.mjs`:

```bash
npm run sw:version          # regenerate after changing any shell asset
npm run sw:version -- --check   # CI mode: fails if sw.js is stale
```

`npm test` regenerates it; CI only checks it. This means a deployed change can never leave users on a stale cache because someone forgot to bump a string. The page offers a "Reload" toast when a new worker takes over (update activation), so users are never silently migrated mid-session.

## Database migrations

Migrations live in `database/migrations/NNN_*.sql`, are applied in filename order, and must be:

- **Idempotent** — every statement uses `if not exists` / safe additive forms, so re-running the chain on an already-migrated database is harmless.
- **Additive** — never rewrite a migration that may have already run on production. If a shipped migration needs fixing, add a new migration that corrects the schema. The applied chain must converge new installs and upgraded installs on the same final schema.
- **Verified in CI** — the `backend-postgres` job applies the full chain twice against a real Postgres 16 and then exercises the optimistic-concurrency CAS and cascade-delete paths end to end.

To apply a new migration on the production database, run its contents once via your database tooling (e.g. `psql "$DATABASE_URL" -f database/migrations/NNN_name.sql`). Because every statement is idempotent, an accidental double-apply is safe.

## Rollback

- **Static app**: redeploy the previous immutable Vercel deployment (Deployments → … → Promote). Users pick the new service worker on their next visit; the old one is gone only if you also rolled back `sw.js`'s generated VERSION, which is why the version is content-derived — the old deployment's worker simply stops matching.
- **API**: serverless functions roll back with the deployment; there is no server state beyond Postgres.
- **Database**: migrations are additive and destructive changes are forbidden by review; rollback is therefore "redeploy the previous app version", not "revert the schema". If a migration must be undone, ship a new forward migration.

## Release checklist (cutting a version)

1. `npm test` locally (unit + content + hygiene + SW version regeneration).
2. `npm run test:e2e` and, ideally, `npm run audit`.
3. Bump `version` in `package.json` (the app surfaces `APP_VERSION` in predictions) and run `npm run sw:version`.
4. Commit → CI green → merge to `main` → verify the production deployment's health at `/` (app loads offline in a fresh tab, sign-in only if configured).
