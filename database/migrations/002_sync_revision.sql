-- Adds the server-side optimistic-concurrency token to deployments created
-- before atomic sync conflict protection shipped.
alter table user_state
  add column if not exists revision bigint not null default 1;
