create table public.item_claims (
  item_id uuid not null,
  user_id uuid not null,
  share real not null,
  claimed_at timestamp with time zone null default now(),
  constraint item_claims_pkey primary key (item_id, user_id),
  constraint item_claims_item_id_fkey foreign KEY (item_id) references items (id) on update CASCADE on delete CASCADE,
  constraint item_claims_user_id_fkey foreign KEY (user_id) references users (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
