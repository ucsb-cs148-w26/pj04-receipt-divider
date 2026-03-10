alter table public.groups
  add column if not exists is_finished boolean not null default false;
