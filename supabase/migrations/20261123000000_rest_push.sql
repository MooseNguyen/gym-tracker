-- Push notification when the rest between sets is over.
--
-- iOS stops a Home Screen web app's JavaScript as soon as the phone locks, so
-- the app cannot raise the alert itself: it stores when the rest ends, and
-- the server sends a Web Push at that time.
--
--   app ──upsert──▶ rest_alerts (one row per account, the latest rest)
--   pg_cron, every 5 s ──▶ private.send_due_rest_alerts()
--     └─ only if a row is due ──▶ pg_net ──▶ Edge Function "rest-alerts"
--          └─ deletes the due rows (claiming them) and pushes to
--             every push_subscriptions row of those accounts
--
-- The Edge Function's URL and the secret it checks live in Supabase Vault
-- (names: rest_alerts_url, rest_alerts_secret), never in a migration. Until
-- both are set the cron job does nothing, so this migration is safe to push
-- before the function is deployed.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One row per account and browser. An account has a row on each phone it
-- turned notifications on; the endpoint is the push service URL for that
-- browser (Apple's, Google's or Mozilla's).
create table push_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null check (endpoint like 'https://%' and length(endpoint) <= 2000),
  -- The browser's public key and auth secret (base64url) that encrypt each message.
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- (select auth.uid()): evaluated once per statement, see the init migration.
-- No update policy: a changed subscription is deleted and inserted again.
create policy "read own push subscriptions" on push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own push subscriptions" on push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete own push subscriptions" on push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- The end of the rest in progress, one per account: a new rest, −15 or +15
-- replaces it (upsert), Skip deletes it. Rows only live for a few minutes.
create table rest_alerts (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  fire_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table rest_alerts enable row level security;

-- The 30-minute cap stops an account from queueing alerts for later; the
-- longest rest the app offers is 5:00, plus a few +15 taps. It sits in the
-- policies rather than a check constraint: now() in a constraint would make
-- a restore of an old backup fail.
create policy "read own rest alert" on rest_alerts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "insert own rest alert" on rest_alerts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and fire_at <= now() + interval '30 minutes');
create policy "update own rest alert" on rest_alerts
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and fire_at <= now() + interval '30 minutes');
create policy "delete own rest alert" on rest_alerts
  for delete to authenticated using (user_id = (select auth.uid()));

-- Server-only code goes in its own schema: PostgREST exposes only public, so
-- nobody can call this through the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Runs every 5 seconds, so it must stay cheap: one look at a table that only
-- holds the rests in progress right now, and an HTTP call only when an alert
-- is due (pg_net sends it after this transaction commits).
create function private.send_due_rest_alerts() returns void
language plpgsql
set search_path = ''
as $$
declare
  fn_url text;
  fn_secret text;
begin
  if not exists (select 1 from public.rest_alerts where fire_at <= now()) then
    return;
  end if;

  select decrypted_secret into fn_url
  from vault.decrypted_secrets where name = 'rest_alerts_url';
  select decrypted_secret into fn_secret
  from vault.decrypted_secrets where name = 'rest_alerts_secret';
  if fn_url is null or fn_secret is null then
    return; -- not configured yet (or a fresh local / CI database)
  end if;

  -- pg_net keeps the request, header included, in net.http_request_queue
  -- until it is sent. That is why the function checks its own secret, not
  -- the service-role key: if it ever leaked, all it allows is sending the
  -- alerts that are already due.
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', fn_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function private.send_due_rest_alerts() from public, anon, authenticated;

select cron.schedule(
  'send-due-rest-alerts',
  '5 seconds',
  $$select private.send_due_rest_alerts()$$
);

-- Every run above leaves a row in cron.job_run_details (about 17,000 a day).
-- Keep one day of history for debugging, drop the rest nightly.
select cron.schedule(
  'purge-cron-history',
  '0 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$
);
