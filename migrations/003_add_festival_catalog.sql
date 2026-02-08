create table festival_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  dates_start date,
  dates_end date,
  ticket_price numeric,
  on_sale_date date
);
