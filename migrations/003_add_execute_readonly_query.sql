-- Migration: Add a Postgres function for executing read-only SQL via RPC
-- Used by the query_database tool to run sub-agent-generated SELECT queries

create or replace function execute_readonly_query(query text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  -- Only allow SELECT statements
  if not (trim(lower(query)) like 'select%') then
    raise exception 'Only SELECT queries are allowed';
  end if;

  execute 'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (' || query || ') t'
    into result;

  return result;
end;
$$;
