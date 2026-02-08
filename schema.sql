-- Festival Coordinator Schema

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  city text,
  phone text
);

create unique index members_phone_idx on members (phone) where phone is not null;

create table calls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  summary text,
  transcript jsonb
);

create table festivals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  location text,
  dates_start date,
  dates_end date,
  ticket_price numeric,
  on_sale_date date,
  status text default 'considering'
);

create table artists (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references festivals(id) on delete cascade,
  name text not null,
  priority text default 'want_to_see'
);
