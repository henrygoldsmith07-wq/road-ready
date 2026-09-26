-- Accounts and cross-device sync for Road Ready.
--
-- Road Ready was local-first with no backend at all. This adds the smallest schema
-- that makes a Google account meaningful across devices: who you are, and one
-- copy of your study progress.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  -- Google's stable subject claim. Preferred over email when matching, because
  -- it survives the user changing the address on their Google account.
  google_sub text unique,
  name text,
  image text,
  created_at timestamptz not null default now()
);

-- One row per user holding one backup bundle.
--
-- The server does not merge: it cannot tell which of two study histories is
-- correct. `revision` is an optimistic-concurrency token so a stale device
-- cannot silently overwrite a newer snapshot.
create table if not exists user_state (
  user_id uuid primary key references users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  -- Schema version of the snapshot, so a newer client can migrate an old one.
  version integer not null default 1,
  revision bigint not null default 1
);

create index if not exists user_state_updated_idx on user_state (updated_at desc);
