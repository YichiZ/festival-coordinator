-- Migration: Add status to members, description to groups

alter table members add column status text not null default 'active';

comment on column members.status is 'Member status: active, inactive, or pending';

alter table groups add column description text;

comment on column groups.description is 'Short description of the friend group';
