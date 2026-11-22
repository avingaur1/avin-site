-- CV request & approval system: database schema.
--
-- Run once in Supabase → SQL Editor (paste the whole file, Run). Safe to re-run.
-- Then run 002_private_storage.sql.
--
-- Only the Cloudflare Worker touches this table, using the service-role (secret) key.
-- The browser never talks to Supabase: Row Level Security is on with NO policies, and the
-- public roles (anon, authenticated) get no table or function access at all.

create table if not exists public.cv_requests (
  id                      uuid primary key default gen_random_uuid(),
  full_name               text not null check (char_length(full_name) between 1 and 100),
  email                   text not null check (char_length(email) between 3 and 254),
  reason                  text check (reason is null or char_length(reason) <= 1000),
  status                  text not null default 'pending'
                            check (status in ('pending', 'approved', 'rejected')),
  created_at              timestamptz not null default now(),
  decided_at              timestamptz,
  -- SHA-256 of the access token, never the token itself.
  access_token_hash       text unique,
  access_expires_at       timestamptz,
  access_revoked_at       timestamptz,
  approval_email_sent_at  timestamptz,
  access_count            integer not null default 0,
  last_accessed_at        timestamptz,
  -- Salted hash of the requester's IP, used only for rate limiting; cleared after 30 days.
  ip_hash                 text,

  constraint cv_decided_when_not_pending check ((status = 'pending') = (decided_at is null)),
  constraint cv_approved_has_access check (
    status <> 'approved' or (access_token_hash is not null and access_expires_at is not null)
  ),
  constraint cv_only_approved_has_access check (
    status = 'approved' or (access_token_hash is null and access_expires_at is null)
  )
);

-- One pending request per email address, enforced by the database (race-safe).
create unique index if not exists cv_requests_one_pending_per_email
  on public.cv_requests (lower(email)) where status = 'pending';
create index if not exists cv_requests_created_at on public.cv_requests (created_at desc);
create index if not exists cv_requests_ip_recent  on public.cv_requests (ip_hash, created_at);

alter table public.cv_requests enable row level security;
-- No policies on purpose: nobody but the service role can read or write.
revoke all on table public.cv_requests from public, anon, authenticated;
grant  all on table public.cv_requests to service_role;

-- Shape returned to the admin pages. Never includes the token hash or IP hash.
create or replace function public.cv_public(r public.cv_requests)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'fullName', r.full_name,
    'email', r.email,
    'reason', r.reason,
    'status', r.status,
    'createdAt', r.created_at,
    'decidedAt', r.decided_at,
    'accessExpiresAt', r.access_expires_at,
    'accessRevokedAt', r.access_revoked_at,
    'approvalEmailSentAt', r.approval_email_sent_at,
    'accessCount', r.access_count,
    'lastAccessedAt', r.last_accessed_at
  );
$$;

-- 1. A visitor asks for the CV.
--    outcome: created | duplicate (already pending) | rate_limited | busy (daily cap reached)
create or replace function public.cv_submit_request(
  p_full_name text,
  p_email text,
  p_reason text,
  p_ip_hash text,
  p_max_per_ip_hour int default 5,
  p_max_per_email_week int default 3,
  p_max_per_day int default 50
)
returns table (outcome text, id uuid, created_at timestamptz)
language plpgsql set search_path = '' as $$
declare
  v_row public.cv_requests;
begin
  -- Serialise submissions so the counts below can't be raced. Volume is tiny, so this is free.
  perform pg_advisory_xact_lock(hashtext('cv_submit_request'));

  -- Keep IP hashes only as long as rate limiting needs them.
  update public.cv_requests r set ip_hash = null
   where r.ip_hash is not null and r.created_at < now() - interval '30 days';

  if p_ip_hash is not null and (
    select count(*) from public.cv_requests r
     where r.ip_hash = p_ip_hash and r.created_at > now() - interval '1 hour'
  ) >= p_max_per_ip_hour then
    return query select 'rate_limited'::text, null::uuid, null::timestamptz; return;
  end if;

  if (
    select count(*) from public.cv_requests r
     where lower(r.email) = lower(p_email) and r.created_at > now() - interval '7 days'
  ) >= p_max_per_email_week then
    return query select 'rate_limited'::text, null::uuid, null::timestamptz; return;
  end if;

  if (
    select count(*) from public.cv_requests r where r.created_at > now() - interval '1 day'
  ) >= p_max_per_day then
    return query select 'busy'::text, null::uuid, null::timestamptz; return;
  end if;

  insert into public.cv_requests (full_name, email, reason, ip_hash)
  values (p_full_name, p_email, nullif(p_reason, ''), p_ip_hash)
  on conflict (lower(email)) where status = 'pending' do nothing
  returning * into v_row;

  if v_row.id is null then
    return query select 'duplicate'::text, null::uuid, null::timestamptz; return;
  end if;
  return query select 'created'::text, v_row.id, v_row.created_at;
end;
$$;

-- 2. Avin approves or rejects. Only a pending request can change, so double clicks and
--    two tabs can't both win.
--    outcome: decided | already_decided | expired (pending too long) | not_found
create or replace function public.cv_decide(
  p_id uuid,
  p_decision text,
  p_token_hash text,
  p_access_hours int default 24,
  p_pending_days int default 30
)
returns table (outcome text, request jsonb)
language plpgsql set search_path = '' as $$
declare
  v_row public.cv_requests;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'bad decision';
  end if;
  if p_decision = 'approve' and coalesce(p_token_hash, '') = '' then
    raise exception 'approval needs a token hash';
  end if;

  update public.cv_requests r set
    status            = case when p_decision = 'approve' then 'approved' else 'rejected' end,
    decided_at        = now(),
    access_token_hash = case when p_decision = 'approve' then p_token_hash end,
    access_expires_at = case when p_decision = 'approve' then now() + make_interval(hours => p_access_hours) end
   where r.id = p_id
     and r.status = 'pending'
     and r.created_at > now() - make_interval(days => p_pending_days)
  returning * into v_row;

  if v_row.id is not null then
    return query select 'decided'::text, public.cv_public(v_row); return;
  end if;

  select * into v_row from public.cv_requests r where r.id = p_id;
  if v_row.id is null then
    return query select 'not_found'::text, null::jsonb;
  elsif v_row.status <> 'pending' then
    return query select 'already_decided'::text, public.cv_public(v_row);
  else
    return query select 'expired'::text, public.cv_public(v_row);
  end if;
end;
$$;

-- 3. Turn off an approved link before it expires.
--    outcome: revoked | not_active | not_found
create or replace function public.cv_revoke(p_id uuid)
returns table (outcome text, request jsonb)
language plpgsql set search_path = '' as $$
declare
  v_row public.cv_requests;
begin
  update public.cv_requests r set access_revoked_at = now()
   where r.id = p_id and r.status = 'approved' and r.access_revoked_at is null
  returning * into v_row;
  if v_row.id is not null then
    return query select 'revoked'::text, public.cv_public(v_row); return;
  end if;
  select * into v_row from public.cv_requests r where r.id = p_id;
  return query select (case when v_row.id is null then 'not_found' else 'not_active' end)::text,
                      case when v_row.id is null then null else public.cv_public(v_row) end;
end;
$$;

-- 4. Send a fresh 24-hour link to someone already approved (e.g. the first email bounced).
--    The old link stops working immediately. outcome: reissued | not_active | not_found
create or replace function public.cv_reissue(p_id uuid, p_token_hash text, p_access_hours int default 24)
returns table (outcome text, request jsonb)
language plpgsql set search_path = '' as $$
declare
  v_row public.cv_requests;
begin
  update public.cv_requests r set
    access_token_hash      = p_token_hash,
    access_expires_at      = now() + make_interval(hours => p_access_hours),
    approval_email_sent_at = null
   where r.id = p_id and r.status = 'approved' and r.access_revoked_at is null
  returning * into v_row;
  if v_row.id is not null then
    return query select 'reissued'::text, public.cv_public(v_row); return;
  end if;
  select * into v_row from public.cv_requests r where r.id = p_id;
  return query select (case when v_row.id is null then 'not_found' else 'not_active' end)::text,
                      case when v_row.id is null then null else public.cv_public(v_row) end;
end;
$$;

create or replace function public.cv_mark_email_sent(p_id uuid)
returns void language sql set search_path = '' as $$
  update public.cv_requests set approval_email_sent_at = now() where id = p_id;
$$;

-- 5. An approved visitor opens the CV. Checked on every view and download.
--    outcome: ok | expired | revoked | invalid
create or replace function public.cv_open(p_token_hash text)
returns table (outcome text, full_name text, expires_at timestamptz)
language plpgsql set search_path = '' as $$
declare
  v_row public.cv_requests;
begin
  select * into v_row from public.cv_requests r
   where r.access_token_hash = p_token_hash and r.status = 'approved'
   for update;
  if v_row.id is null then
    return query select 'invalid'::text, null::text, null::timestamptz; return;
  end if;
  if v_row.access_revoked_at is not null then
    return query select 'revoked'::text, null::text, null::timestamptz; return;
  end if;
  if v_row.access_expires_at <= now() then
    return query select 'expired'::text, null::text, null::timestamptz; return;
  end if;
  update public.cv_requests r set access_count = r.access_count + 1, last_accessed_at = now()
   where r.id = v_row.id;
  return query select 'ok'::text, v_row.full_name, v_row.access_expires_at;
end;
$$;

-- 6. Admin reads (newest first, capped).
create or replace function public.cv_list(p_status text default null, p_limit int default 200)
returns table (request jsonb)
language sql stable set search_path = '' as $$
  select public.cv_public(r) from public.cv_requests r
   where p_status is null or r.status = p_status
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.cv_get(p_id uuid)
returns table (request jsonb)
language sql stable set search_path = '' as $$
  select public.cv_public(r) from public.cv_requests r where r.id = p_id;
$$;

-- Supabase grants EXECUTE on new functions to anon/authenticated by default. Take that back.
do $$
declare f text;
begin
  foreach f in array array[
    'public.cv_public(public.cv_requests)',
    'public.cv_submit_request(text, text, text, text, int, int, int)',
    'public.cv_decide(uuid, text, text, int, int)',
    'public.cv_revoke(uuid)',
    'public.cv_reissue(uuid, text, int)',
    'public.cv_mark_email_sent(uuid)',
    'public.cv_open(text)',
    'public.cv_list(text, int)',
    'public.cv_get(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
