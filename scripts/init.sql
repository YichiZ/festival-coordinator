-- Festival Coordinator: consolidated init (extensions + schema + catalog seed + app seed)

-- Extensions
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- Schema
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  created_at timestamptz default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  city text,
  phone text,
  status text not null default 'active'
);
create unique index members_phone_idx on members (phone) where phone is not null;
comment on column members.phone is 'Phone number for identifying returning callers, e.g. +14155551234';
comment on column members.status is 'Member status: active, inactive, or pending';
comment on column groups.description is 'Short description of the friend group';

create table calls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  summary text,
  transcript jsonb,
  from_number text
);
comment on column calls.transcript is 'Full conversation transcript as JSONB array of {role, content, timestamp} objects';

create table festivals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  location text,
  dates_start date,
  dates_end date,
  ticket_price numeric,
  on_sale_date date,
  status text default 'considering',
  latitude double precision,
  longitude double precision
);

create table artists (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references festivals(id) on delete cascade,
  name text not null,
  priority text default 'want_to_see'
);

create table festival_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  dates_start date,
  dates_end date,
  ticket_price numeric,
  on_sale_date date,
  latitude double precision,
  longitude double precision
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references members(id) on delete cascade,
  festival_id uuid not null references festivals(id) on delete cascade,
  stars smallint not null,
  text text,
  created_at timestamptz default now()
);

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

-- Festival catalog seed
insert into festival_catalog (name, location, dates_start, dates_end, ticket_price, on_sale_date, latitude, longitude) values
  ('Coachella', 'Indio, CA', '2026-04-10', '2026-04-12', 549, '2026-01-10', 33.6810, -116.2374),
  ('Tomorrowland', 'Boom, Belgium', '2026-07-17', '2026-07-19', 375, '2026-02-01', 51.0925, 4.3669),
  ('Lollapalooza', 'Chicago, IL', '2026-07-30', '2026-08-02', 400, '2026-03-15', 41.8781, -87.6298),
  ('Bonnaroo', 'Manchester, TN', '2026-06-11', '2026-06-14', 350, '2026-01-20', 35.4881, -86.0872),
  ('Electric Daisy Carnival', 'Las Vegas, NV', '2026-05-15', '2026-05-17', 450, '2026-02-15', 36.1024, -115.1740),
  ('Glastonbury', 'Somerset, England', '2026-06-24', '2026-06-28', 340, '2025-11-01', 51.1474, -2.5845),
  ('Ultra Music Festival', 'Miami, FL', '2026-03-27', '2026-03-29', 500, '2025-12-01', 25.7617, -80.1918);

-- App seed (truncate then insert; order respects foreign keys)
truncate reviews, artists, festivals, calls, members, groups cascade;

insert into groups (id, name, description) values
  ('aaaaaaaa-0001-4000-a000-000000000001', 'Bay Area Bassheads',   'SF crew that lives for bass music and desert festivals'),
  ('aaaaaaaa-0001-4000-a000-000000000002', 'East Coast Explorers', 'NYC-to-Boston friends branching out into new festivals'),
  ('aaaaaaaa-0001-4000-a000-000000000003', 'Solo Starters',       'New members not yet in a group');

insert into members (id, group_id, name, city, phone, status) values
  ('bbbbbbbb-0001-4000-b000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000001', 'Yichi',      'San Francisco, CA', '+14156403871', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000001', 'Alex',       'San Francisco, CA', '+14155550101', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000003', 'aaaaaaaa-0001-4000-a000-000000000001', 'Maria',      'Oakland, CA',       '+15105550102', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000004', 'aaaaaaaa-0001-4000-a000-000000000001', 'Jordan',     'San Jose, CA',      '+14085550103', 'pending'),
  ('bbbbbbbb-0001-4000-b000-000000000005', 'aaaaaaaa-0001-4000-a000-000000000002', 'Jack',       'New York, NY',      '+12125550201', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000006', 'aaaaaaaa-0001-4000-a000-000000000002', 'Jacqueline', 'Brooklyn, NY',      '+17185550202', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000007', 'aaaaaaaa-0001-4000-a000-000000000002', 'Steve',      'Boston, MA',        '+16175550203', 'active'),
  ('bbbbbbbb-0001-4000-b000-000000000008', 'aaaaaaaa-0001-4000-a000-000000000002', 'Priya',      'Philadelphia, PA',  '+12155550204', 'inactive'),
  ('bbbbbbbb-0001-4000-b000-000000000009', 'aaaaaaaa-0001-4000-a000-000000000003', 'Sam',        'Austin, TX',        '+15125550301', 'pending');

insert into festivals (id, group_id, name, location, dates_start, dates_end, ticket_price, on_sale_date, status, latitude, longitude) values
  ('cccccccc-0001-4000-c000-000000000004', 'aaaaaaaa-0001-4000-a000-000000000002', 'Governors Ball 2026',   'New York, NY',     '2026-06-05', '2026-06-07', 355,  '2026-01-20', 'committed', 40.7829, -73.9654),
  ('cccccccc-0001-4000-c000-000000000005', 'aaaaaaaa-0001-4000-a000-000000000002', 'Bonnaroo 2026',         'Manchester, TN',   '2026-06-11', '2026-06-14', 400,  '2026-01-08', 'considering', 35.4881, -86.0872);

insert into artists (id, festival_id, name, priority) values
  ('dddddddd-0001-4000-d000-000000000007', 'cccccccc-0001-4000-c000-000000000004', 'SZA',               'must_see'),
  ('dddddddd-0001-4000-d000-000000000008', 'cccccccc-0001-4000-c000-000000000004', 'Dominic Fike',      'want_to_see'),
  ('dddddddd-0001-4000-d000-000000000009', 'cccccccc-0001-4000-c000-000000000004', 'Raye',              'must_see'),
  ('dddddddd-0001-4000-d000-000000000010', 'cccccccc-0001-4000-c000-000000000005', 'Tame Impala',       'must_see'),
  ('dddddddd-0001-4000-d000-000000000011', 'cccccccc-0001-4000-c000-000000000005', 'Japanese Breakfast', 'want_to_see');

insert into calls (id, group_id, started_at, ended_at, summary, from_number) values
  ('eeeeeeee-0001-4000-e000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000001',
    '2026-02-01 18:30:00+00', '2026-02-01 18:45:00+00',
    '- Group decided on "Bay Area Bassheads" as the crew name\n- Yichi, Alex, and Maria are in the group\n- Jordan might join but hasn''t committed yet (pending)\n- Haven''t picked a festival yet — need to explore options',
    '+14156403871'),
  ('eeeeeeee-0001-4000-e000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000002',
    '2026-02-03 20:00:00+00', '2026-02-03 20:20:00+00',
    '- East Coast Explorers locked in for Governors Ball\n- Jack and Jacqueline buying tickets this week\n- Steve interested in Bonnaroo as a road trip\n- Priya dropped out (marked inactive)',
    '+12125550201');

insert into reviews (user_id, festival_id, stars, text) values
  ('bbbbbbbb-0001-4000-b000-000000000005', 'cccccccc-0001-4000-c000-000000000004', 5, 'Governors Ball was incredible. SZA and Raye killed it.'),
  ('bbbbbbbb-0001-4000-b000-000000000006', 'cccccccc-0001-4000-c000-000000000004', 4, 'Great vibes, would go again. Lineup was solid.'),
  ('bbbbbbbb-0001-4000-b000-000000000007', 'cccccccc-0001-4000-c000-000000000005', 5, 'Bonnaroo is the best. Tame Impala and Japanese Breakfast were highlights.');
