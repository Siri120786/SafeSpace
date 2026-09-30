-- 0002_pin_attempts.sql
-- Failed-PIN log used by verify-child-pin to rate-limit guessing per family.
-- Only the service role (Edge Functions) touches this table; RLS is enabled with
-- no policies, so anon/authenticated clients can read or write nothing.

create table pin_attempts (
  id bigint generated always as identity primary key,
  family_code text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index pin_attempts_family_recent on pin_attempts (family_code, attempted_at desc);

alter table pin_attempts enable row level security;
