-- Festival Coordinator — initial schema
-- Applied automatically by: supabase db reset

-- ── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ── Tables ────────────────────────────────────────────────────────────────────

create table groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text,
  description text,
  created_at  timestamptz default now()
);

comment on column groups.description is 'Short description of the friend group';

create table members (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name     text not null,
  city     text,
  phone    text,
  status   text not null default 'active'
);

create unique index members_phone_idx on members (phone) where phone is not null;

comment on column members.phone   is 'Phone number for identifying returning callers, e.g. +14155551234';
comment on column members.status  is 'Member status: active, inactive, or pending';

create table calls (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        references groups(id) on delete cascade,
  started_at  timestamptz default now(),
  ended_at    timestamptz,
  summary     text,
  transcript  jsonb,
  from_number text
);

comment on column calls.transcript is 'Full conversation transcript as JSONB array of {role, content, timestamp} objects';

create table festivals (
  id           uuid    primary key default gen_random_uuid(),
  group_id     uuid    references groups(id) on delete cascade,
  name         text    not null,
  location     text,
  dates_start  date,
  dates_end    date,
  ticket_price numeric,
  on_sale_date date,
  status       text    default 'considering',
  latitude     double precision,
  longitude    double precision
);

create table artists (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid references festivals(id) on delete cascade,
  name        text not null,
  priority    text default 'want_to_see'
);

create table festival_catalog (
  id           uuid    primary key default gen_random_uuid(),
  name         text    not null,
  location     text,
  dates_start  date,
  dates_end    date,
  ticket_price numeric,
  on_sale_date date,
  latitude     double precision,
  longitude    double precision
);

create table reviews (
  id          uuid      primary key default gen_random_uuid(),
  user_id     uuid      not null references members(id) on delete cascade,
  festival_id uuid      not null references festivals(id) on delete cascade,
  stars       smallint  not null,
  text        text,
  created_at  timestamptz default now()
);

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Execute a read-only SQL query and return results as JSONB.
-- Used by the query_database tool to run sub-agent-generated SELECT queries.
create or replace function execute_readonly_query(query text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if not (trim(lower(query)) like 'select%') then
    raise exception 'Only SELECT queries are allowed';
  end if;
  execute 'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (' || query || ') t'
    into result;
  return result;
end;
$$;

-- Search festival_catalog by name (partial, case-insensitive) with optional
-- distance ordering using PostGIS.
create or replace function search_festival_catalog(
  p_name text    default null,
  p_lat  float8  default null,
  p_lon  float8  default null
) returns setof festival_catalog language sql as $$
  select * from festival_catalog
  where (p_name is null or name ilike '%' || p_name || '%')
  order by
    case when p_lat is not null and p_lon is not null
      then st_distance(
        st_makepoint(longitude, latitude)::geography,
        st_makepoint(p_lon, p_lat)::geography
      )
    end asc nulls last,
    dates_start asc nulls last;
$$;
