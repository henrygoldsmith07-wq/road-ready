-- Server-side session revocation.
--
-- A session cookie is a self-contained signed token, so signing out could only
-- clear the cookie in that browser. A leaked or cloned cookie stayed valid for
-- its full 30-day life. This column records the moment every session for an
-- account was invalidated; a token issued before it is refused by the routes.
--
-- NULL means "never revoked", which is the state of every existing account.

alter table users add column if not exists revoked_before timestamptz;

comment on column users.revoked_before is
  'Sessions issued before this timestamp are refused. NULL means never revoked.';
