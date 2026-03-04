create table public.groups (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  created_by uuid not null,
  name text null,
  constraint groups_pkey primary key (id),
  constraint groups_created_by_fkey foreign KEY (created_by) references profiles (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
