create table public.item_claims (
  item_id uuid not null,
  profile_id uuid not null,
  share real not null,
  claimed_at timestamp with time zone null default now(),
  constraint item_claims_pkey primary key (item_id, profile_id),
  constraint item_claims_item_id_fkey foreign KEY (item_id) references items (id) on update CASCADE on delete CASCADE,
  constraint item_claims_profile_id_fkey foreign KEY (profile_id) references profiles (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
