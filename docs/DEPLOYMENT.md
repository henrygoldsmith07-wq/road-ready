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
| `NODE_ENV` | accounts, production | Set to `production`. Vercel sets it automatically, and the app also treats `VERCEL_ENV=production` or `VERCEL=1` as production, so the session cookie still gets `Secure` and the `__Host-` prefix if `NODE_ENV` is ever missing. |

No accounts configured? Deploy the static app as-is — sign-in never appears and the PWA works fully offline.

Keep local secrets in a `.env` file. `.env`, `.env.local` and `.env.*.local` are git-ignored; `.env.example` is the tracked template.

## Before promoting a commit to production

1. CI must be green on the exact commit being deployed: lint, typecheck, service-worker version check, production dependency audit, unit + content + hygiene tests, Postgres integration, E2E on all three projects, Lighthouse.
2. Configure branch protection on `main` to require the CI checks (Settings → Branches). Suggested minimum: require `lint-and-typecheck`, `unit-and-content`, `audit`, `backend-postgres`, `e2e`, and `lighthouse`; require at least one review; disallow force pushes.
3. Prefer deploying from the `main` branch only (Vercel: Production Branch = `main`). A broken commit that cannot reach `main` cannot silently become production.

## The Lighthouse gate, and what it measures

The Lighthouse job scores the app served by `serve.js` and takes the **median of 5 runs**. The
thresholds (`performance 0.70`, `accessibility 0.90`, `best-practices 0.90`, `seo 0.80`) have not
changed and must not be loosened to make a build pass.

Two details of the harness matter when a run looks wrong:

- The job **waits for the server to answer** (`scripts/wait-for-server.mjs`) and warms it before
  measuring. An earlier version slept for a fixed two seconds, which raced the server's start-up:
  on a loaded runner the first measured request paid Node's start-up cost, so the score reported
  the runner rather than the app. A cold first run was observed scoring 0.47 on an unchanged
  `main`. Nobody opening the app waits for a cold Node process, so the measurement should not
  either.
- The median of 5 exists because a single run on a shared runner moves by more than 0.2. The
  median is taken over all five runs for every category, so one slow run cannot decide the build.

If the gate fails, check the printed `performance runs` line: one outlier low value with the rest
comfortably above the threshold is runner noise, while a consistent set of low values is a real
regression and should be investigated against the audit details.

## Deployment Protection (decision)

**Decision: Standard Protection — production stays public, previews stay gated.**

- Production (the `main` branch on the production domain) must remain **unprotected**. Road Ready is a public, no-login PWA: enabling protection on “All Deployments” would put Vercel Authentication or a password in front of every anonymous learner, breaking open study access, PWA installability, offline-first loading, SEO, and the Lighthouse CI gate.
- Preview deployments keep **Vercel Authentication** under the **Standard Protection** scope, so in-progress content branches are never publicly browsable.
- This is a dashboard setting (Project → Settings → Deployment Protection), not code: `vercel.json` has no field for it, so there is nothing to commit — record any change here. To apply: scope = Standard Protection, method = Vercel Authentication.
- No CI impact: E2E and Lighthouse run against local `serve.js`, never against preview URLs. If preview-URL testing is ever needed, use Protection Bypass for Automation and store the secret in the CI provider’s secrets — never in the repo.

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
