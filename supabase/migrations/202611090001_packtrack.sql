-- PackTrack: all money is integer agorot; timestamps are instants in UTC.
-- A single dated compensation row also records the effective role.
create schema if not exists app_private;
revoke all on schema app_private from public;

create function app_private.valid_rates(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; n numeric; allowed text[] := array['role','hourlyRate','hourlyAdjustment','creditedMinutes','studentRate','sigmaRate','privateSharedRate','privateSoloRate'];
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(value)) <> 8 then return false; end if;
  if not (value ?& allowed) or coalesce(value->>'role','') not in ('regular','review','checker') then return false; end if;
  foreach k in array array['hourlyRate','studentRate','sigmaRate','privateSharedRate','privateSoloRate'] loop
    if value->k <> 'null'::jsonb then
      if jsonb_typeof(value->k) <> 'number' then return false; end if;
      n := (value->>k)::numeric;
      if n <> trunc(n) or n < 0 or n > 1000000 then return false; end if;
    end if;
  end loop;
  foreach k in array array['hourlyAdjustment','creditedMinutes'] loop
    if jsonb_typeof(value->k) <> 'number' then return false; end if;
    n := (value->>k)::numeric;
    if n <> trunc(n) then return false; end if;
    if k = 'hourlyAdjustment' and abs(n) > 1000000 then return false; end if;
    if k = 'creditedMinutes' and (n < 0 or n > 1440) then return false; end if;
  end loop;
  if value->'hourlyRate' <> 'null'::jsonb and (value->>'hourlyRate')::int + (value->>'hourlyAdjustment')::int < 0 then return false; end if;
  return true;
exception when others then return false;
end $$;

create function app_private.valid_counts(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; n numeric;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(value)) <> 4 or not (value ?& array['student','sigma','privateShared','privateSolo']) then return false; end if;
  foreach k in array array['student','sigma','privateShared','privateSolo'] loop
    if jsonb_typeof(value->k) <> 'number' then return false; end if;
    n := (value->>k)::numeric;
    if n <> trunc(n) or n < 0 or n > 10000 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.compensation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  effective_from date not null,
  rates jsonb not null check (app_private.valid_rates(rates)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, effective_from),
  unique(id, user_id)
);
create table public.shifts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  break_minutes integer not null check (break_minutes >= 0),
  counts jsonb not null check (app_private.valid_counts(counts)),
  rates_snapshot jsonb not null check (app_private.valid_rates(rates_snapshot)),
  notes text not null default '' check (length(notes) <= 2000),
  time_disambiguation text not null default 'reject' check (time_disambiguation in ('reject','earlier','later')),
  version integer not null default 1 check (version > 0),
  last_request jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id),
  check (end_at > start_at and end_at - start_at <= interval '24 hours'),
  check (break_minutes * interval '1 minute' < end_at - start_at),
  check (date_trunc('minute', start_at) = start_at and date_trunc('minute', end_at) = end_at),
  check (work_date = (start_at at time zone 'Asia/Jerusalem')::date)
);
create index shifts_user_work_date_idx on public.shifts(user_id, work_date desc);
create index shifts_user_interval_idx on public.shifts(user_id, start_at, end_at);
create table public.shift_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid not null,
  amount integer not null check (amount between -10000000 and 10000000),
  description text not null default '' check (length(description) <= 200),
  position integer not null check (position between 0 and 49),
  created_at timestamptz not null default now(),
  unique(shift_id, position),
  foreign key (shift_id, user_id) references public.shifts(id, user_id) on delete cascade
);
create index shift_bonuses_user_shift_idx on public.shift_bonuses(user_id, shift_id);

alter table public.profiles enable row level security;
alter table public.compensation_history enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_bonuses enable row level security;
create policy profiles_owner on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy compensation_owner on public.compensation_history for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shifts_owner on public.shifts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bonuses_owner on public.shift_bonuses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Writes use the three narrow transactional functions below. RLS is defense in depth.
revoke all on public.profiles, public.compensation_history, public.shifts, public.shift_bonuses from anon, authenticated;
grant select on public.profiles, public.compensation_history, public.shifts, public.shift_bonuses to authenticated;

create function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r text; hourly integer; rates jsonb;
begin
  r := coalesce(new.raw_user_meta_data->>'packer_role', 'regular');
  if r not in ('regular','review','checker') then r := 'regular'; end if;
  -- Metadata is untrusted input. An invalid optional rate is left unconfigured.
  begin
    if jsonb_typeof(new.raw_user_meta_data->'hourly_rate') = 'number' and
      (new.raw_user_meta_data->>'hourly_rate')::numeric = trunc((new.raw_user_meta_data->>'hourly_rate')::numeric) and
      (new.raw_user_meta_data->>'hourly_rate')::numeric between 0 and 1000000 then
      hourly := (new.raw_user_meta_data->>'hourly_rate')::int;
    end if;
  exception when others then hourly := null;
  end;
  rates := jsonb_build_object('role',r,'hourlyRate',hourly,'hourlyAdjustment',0,'creditedMinutes',0,
    'studentRate',case when r='regular' then 1100 else null end,'sigmaRate',case when r='regular' then 1100 else null end,
    'privateSharedRate',case when r='regular' then 900 else null end,'privateSoloRate',null);
  insert into public.profiles(id) values(new.id);
  insert into public.compensation_history(user_id,effective_from,rates) values(new.id,'1900-01-01',rates);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app_private.handle_new_user();

-- Existing Auth identities also receive a private profile. Unknown wages remain
-- unconfigured; users can set their effective history before recording shifts.
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
insert into public.compensation_history(user_id,effective_from,rates)
select id, '1900-01-01'::date,
  jsonb_build_object('role',role,'hourlyRate',null,'hourlyAdjustment',0,'creditedMinutes',0,
    'studentRate',case when role='regular' then 1100 else null end,
    'sigmaRate',case when role='regular' then 1100 else null end,
    'privateSharedRate',case when role='regular' then 900 else null end,'privateSoloRate',null)
from (select id,case when raw_user_meta_data->>'packer_role' in ('regular','review','checker')
  then raw_user_meta_data->>'packer_role' else 'regular' end as role from auth.users) existing
on conflict(user_id,effective_from) do nothing;

create function public.set_compensation(p_effective_from date, p_rates jsonb)
returns public.compensation_history language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result public.compensation_history;
begin
  if uid is null then raise exception 'PACKTRACK_AUTH_REQUIRED'; end if;
  if p_effective_from is null or not isfinite(p_effective_from) or not app_private.valid_rates(p_rates) then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  perform 1 from public.profiles where id=uid for update;
  if not found then raise exception 'PACKTRACK_AUTH_REQUIRED'; end if;
  insert into public.compensation_history(user_id,effective_from,rates) values(uid,p_effective_from,p_rates)
    on conflict(user_id,effective_from) do update set rates=excluded.rates,updated_at=now()
    returning * into result;
  return result;
end $$;

create function public.save_shift(p_shift jsonb, p_expected_version integer default 0, p_override jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); sid uuid; existing public.shifts; saved public.shifts;
  workday date; starts timestamptz; ends timestamptz; pause integer; rates jsonb;
  bonus jsonb; amount_value numeric; ordinal integer := 0; request jsonb;
  k text; count_value integer; source_date date;
begin
  if uid is null then raise exception 'PACKTRACK_AUTH_REQUIRED'; end if;
  if p_shift is null or jsonb_typeof(p_shift)<>'object' or p_expected_version is null or p_expected_version < 0 then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  begin
    sid := (p_shift->>'id')::uuid; workday := (p_shift->>'workDate')::date;
    starts := (p_shift->>'startAt')::timestamptz; ends := (p_shift->>'endAt')::timestamptz;
    if jsonb_typeof(p_shift->'breakMinutes') <> 'number' or (p_shift->>'breakMinutes')::numeric <> trunc((p_shift->>'breakMinutes')::numeric) then raise exception 'bad break'; end if;
    pause := (p_shift->>'breakMinutes')::int;
  exception when others then raise exception 'PACKTRACK_INVALID_INPUT'; end;
  if sid is null or workday is null or starts is null or ends is null or pause is null or
    not isfinite(workday) or not isfinite(starts) or not isfinite(ends) or
    not app_private.valid_counts(p_shift->'counts') or
    coalesce(jsonb_typeof(p_shift->'notes'),'null') <> 'string' or length(p_shift->>'notes') > 2000 or
    coalesce(p_shift->>'timeDisambiguation','') not in ('reject','earlier','later') or
    coalesce(jsonb_typeof(p_shift->'bonuses'),'null') <> 'array' then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  if jsonb_array_length(p_shift->'bonuses') > 50 or pause < 0 or ends <= starts or ends-starts > interval '24 hours' or
    pause*interval '1 minute' >= ends-starts or date_trunc('minute',starts)<>starts or date_trunc('minute',ends)<>ends or
    workday<>(starts at time zone 'Asia/Jerusalem')::date or
    to_char(starts at time zone 'Asia/Jerusalem','HH24:MI') is distinct from (p_shift->>'startTime') or
    to_char(ends at time zone 'Asia/Jerusalem','HH24:MI') is distinct from (p_shift->>'endTime') or
    coalesce(jsonb_typeof(p_shift->'endNextDay'),'null') <> 'boolean' then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  source_date := (ends at time zone 'Asia/Jerusalem')::date;
  if source_date <> workday + (case when (p_shift->>'endNextDay')::boolean then 1 else 0 end) then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  for bonus in select value from jsonb_array_elements(p_shift->'bonuses') loop
    if jsonb_typeof(bonus) <> 'object' or coalesce(jsonb_typeof(bonus->'amount'),'null') <> 'number' or
      coalesce(jsonb_typeof(bonus->'description'),'null') <> 'string' or length(bonus->>'description') > 200 then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
    amount_value := (bonus->>'amount')::numeric;
    if amount_value <> trunc(amount_value) or abs(amount_value)>10000000 then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  end loop;
  -- Every shift/compensation writer takes the same per-user row lock. Concurrent
  -- requests cannot pass the overlap check against stale data.
  perform 1 from public.profiles where id=uid for update;
  if not found then raise exception 'PACKTRACK_AUTH_REQUIRED'; end if;
  select * into existing from public.shifts where id=sid and user_id=uid;
  request := jsonb_build_object('shift',p_shift,'override',p_override,'expectedVersion',p_expected_version);
  if existing.id is not null then
    if existing.last_request=request then
      return jsonb_build_object('shift',to_jsonb(existing),'bonuses',coalesce((select jsonb_agg(to_jsonb(b) order by b.position) from public.shift_bonuses b where b.shift_id=sid and b.user_id=uid),'[]'::jsonb));
    end if;
    if p_expected_version <> existing.version then raise exception 'PACKTRACK_CONFLICT'; end if;
    rates := existing.rates_snapshot;
  else
    if p_expected_version<>0 then raise exception 'PACKTRACK_NOT_FOUND'; end if;
    select h.rates into rates from public.compensation_history h where h.user_id=uid and h.effective_from<=workday order by h.effective_from desc limit 1;
  end if;
  if p_override is not null then rates := p_override; end if;
  if rates is null then raise exception 'PACKTRACK_MISSING_RATES'; end if;
  if not app_private.valid_rates(rates) then raise exception 'PACKTRACK_INVALID_INPUT'; end if;
  if rates->'hourlyRate'='null'::jsonb then raise exception 'PACKTRACK_MISSING_RATES'; end if;
  foreach k in array array['student','sigma','privateShared','privateSolo'] loop
    count_value := (p_shift->'counts'->>k)::int;
    if count_value>0 and rates->(k || 'Rate')='null'::jsonb then raise exception 'PACKTRACK_MISSING_RATES'; end if;
  end loop;
  if exists(select 1 from public.shifts s where s.user_id=uid and s.id<>sid and s.start_at<ends and s.end_at>starts) then raise exception 'PACKTRACK_OVERLAP'; end if;
  if existing.id is null then
    insert into public.shifts(id,user_id,work_date,start_at,end_at,break_minutes,counts,rates_snapshot,notes,time_disambiguation,last_request)
      values(sid,uid,workday,starts,ends,pause,p_shift->'counts',rates,p_shift->>'notes',p_shift->>'timeDisambiguation',request) returning * into saved;
  else
    update public.shifts set work_date=workday,start_at=starts,end_at=ends,break_minutes=pause,counts=p_shift->'counts',rates_snapshot=rates,
      notes=p_shift->>'notes',time_disambiguation=p_shift->>'timeDisambiguation',version=version+1,updated_at=now(),last_request=request where id=sid and user_id=uid returning * into saved;
  end if;
  delete from public.shift_bonuses where shift_id=sid and user_id=uid;
  for bonus in select value from jsonb_array_elements(p_shift->'bonuses') loop
    insert into public.shift_bonuses(user_id,shift_id,amount,description,position) values(uid,sid,(bonus->>'amount')::int,bonus->>'description',ordinal);
    ordinal := ordinal+1;
  end loop;
  return jsonb_build_object('shift',to_jsonb(saved),'bonuses',coalesce((select jsonb_agg(to_jsonb(b) order by b.position) from public.shift_bonuses b where b.shift_id=sid and b.user_id=uid),'[]'::jsonb));
exception when unique_violation then raise exception 'PACKTRACK_CONFLICT';
end $$;

create function public.delete_shift(p_id uuid, p_expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.shifts;
begin
  if uid is null then raise exception 'PACKTRACK_AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id=uid for update;
  select * into existing from public.shifts where id=p_id and user_id=uid;
  if existing.id is null then raise exception 'PACKTRACK_NOT_FOUND'; end if;
  if p_expected_version is distinct from existing.version then raise exception 'PACKTRACK_CONFLICT'; end if;
  delete from public.shifts where id=p_id and user_id=uid;
end $$;

revoke all on all functions in schema app_private from public;
revoke all on function public.save_shift(jsonb,integer,jsonb), public.delete_shift(uuid,integer), public.set_compensation(date,jsonb) from public, anon;
grant execute on function public.save_shift(jsonb,integer,jsonb), public.delete_shift(uuid,integer), public.set_compensation(date,jsonb) to authenticated;
