-- Rest-over push notifications (migration 20261123000000_rest_push.sql):
-- each account sees and changes only its own subscriptions and alert, the
-- server-side function is out of reach of the API, and a due alert queues
-- exactly one call to the Edge Function. Run by CI on a fresh database; any
-- failed check raises. Everything happens in a transaction that is rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'b@example.test');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Account B turns notifications on and starts a rest (user_id from the default).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
insert into push_subscriptions (endpoint, p256dh, auth)
values ('https://web.push.apple.com/b', 'b-key', 'b-auth');
insert into rest_alerts (fire_at) values (now() + interval '90 seconds');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
do $$
begin
  if exists (select 1 from push_subscriptions) or exists (select 1 from rest_alerts) then
    raise exception 'an account could read another account''s push rows';
  end if;

  delete from push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000f2';
  if found then
    raise exception 'an account could delete another account''s subscription';
  end if;

  update rest_alerts set fire_at = now() where user_id = '00000000-0000-0000-0000-0000000000f2';
  if found then
    raise exception 'an account could move another account''s rest alert';
  end if;

  delete from rest_alerts where user_id = '00000000-0000-0000-0000-0000000000f2';
  if found then
    raise exception 'an account could delete another account''s rest alert';
  end if;

  begin
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-0000-0000-0000000000f2', 'https://evil.example/a', 'k', 'a');
    raise exception 'an account could add a subscription to someone else';
  exception when insufficient_privilege then null; -- expected (RLS)
  end;

  begin
    insert into rest_alerts (user_id, fire_at)
    values ('00000000-0000-0000-0000-0000000000f2', now() + interval '1 minute');
    raise exception 'an account could queue an alert for someone else';
  exception when insufficient_privilege then null; -- expected (RLS)
  end;

  begin
    insert into rest_alerts (fire_at) values (now() + interval '2 hours');
    raise exception 'an alert two hours ahead was accepted';
  exception when insufficient_privilege then null; -- expected (the 30-minute cap)
  end;

  begin
    insert into push_subscriptions (endpoint, p256dh, auth)
    values ('http://plain.example/a', 'k', 'a');
    raise exception 'a non-https push endpoint was accepted';
  exception when check_violation then null; -- expected
  end;

  -- Its own alert: insert, then the upsert the app sends replaces it.
  insert into rest_alerts (fire_at) values (now() + interval '60 seconds');
  insert into rest_alerts (user_id, fire_at)
  values ('00000000-0000-0000-0000-0000000000f1', now() + interval '75 seconds')
  on conflict (user_id) do update set fire_at = excluded.fire_at, updated_at = now();
  if (select count(*) from rest_alerts) <> 1
    or (select fire_at from rest_alerts) <> now() + interval '75 seconds' then
    raise exception 'a new rest did not replace the previous alert';
  end if;

  delete from rest_alerts;
  if not found then
    raise exception 'an account could not delete its own rest alert (Skip)';
  end if;

  insert into push_subscriptions (endpoint, p256dh, auth)
  values ('https://web.push.apple.com/a', 'a-key', 'a-auth');
  delete from push_subscriptions where endpoint = 'https://web.push.apple.com/a';
  if not found then
    raise exception 'an account could not turn its own notifications off';
  end if;

  begin
    perform private.send_due_rest_alerts();
    raise exception 'an account could call the server-side sender';
  exception when insufficient_privilege then null; -- expected
  end;
end $$;

-- Account B's rows are untouched.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
do $$
begin
  if (select count(*) from push_subscriptions) <> 1 or (select count(*) from rest_alerts) <> 1 then
    raise exception 'another account''s push rows were changed';
  end if;
end $$;

reset role;

-- The cron job: nothing due, or not configured, queues no HTTP call; a due
-- alert with the Vault secrets set queues exactly one.
do $$
declare
  queued_before bigint := (select count(*) from net.http_request_queue);
begin
  if not exists (select 1 from cron.job where jobname = 'send-due-rest-alerts' and schedule = '5 seconds') then
    raise exception 'the send-due-rest-alerts cron job is missing';
  end if;

  perform private.send_due_rest_alerts(); -- B's alert is 90 s away
  update public.rest_alerts set fire_at = now() - interval '1 second';
  perform private.send_due_rest_alerts(); -- due, but Vault is empty
  if (select count(*) from net.http_request_queue) <> queued_before then
    raise exception 'an HTTP call was queued with nothing to send';
  end if;

  perform vault.create_secret('https://example.test/functions/v1/rest-alerts', 'rest_alerts_url');
  perform vault.create_secret('test-secret', 'rest_alerts_secret');
  perform private.send_due_rest_alerts();
  if (select count(*) from net.http_request_queue) <> queued_before + 1 then
    raise exception 'a due alert did not queue one call to the Edge Function';
  end if;
  if not exists (
    select 1 from net.http_request_queue
    where url = 'https://example.test/functions/v1/rest-alerts'
      and headers ->> 'x-cron-secret' = 'test-secret'
  ) then
    raise exception 'the queued call has the wrong URL or secret header';
  end if;
end $$;

rollback;
