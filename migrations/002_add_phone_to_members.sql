-- Migration: Add phone column to members table

alter table members add column phone text;

create unique index members_phone_idx on members (phone) where phone is not null;

comment on column members.phone is 'Phone number for identifying returning callers, e.g. +14155551234';
