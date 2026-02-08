-- Migration: Add transcript column to calls table
-- Stores the full conversation transcript as JSONB array

alter table calls add column transcript jsonb;

comment on column calls.transcript is 'Full conversation transcript as JSONB array of {role, content, timestamp} objects';
