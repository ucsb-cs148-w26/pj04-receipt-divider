create table public.items (
  id uuid not null default gen_random_uuid (),
  receipt_id uuid null,
  name text not null,
  amount smallint not null,
  unit_price real not null,
  created_at timestamp with time zone null default now(),
  group_id uuid not null,
  constraint items_pkey primary key (id),
  constraint items_group_id_fkey foreign KEY (group_id) references groups (id) on update CASCADE on delete CASCADE,
  constraint items_receipt_id_fkey foreign KEY (receipt_id) references receipts (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
