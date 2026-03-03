create table public.receipts (
  -- TODO: change to receipt_id
  id uuid not null default gen_random_uuid (),
  image text not null,
  total real not null,
  created_by uuid not null,
  created_at timestamp with time zone null default now(),
  group_id uuid not null,
  constraint receipts_pkey primary key (id),
  constraint receipts_image_key unique (image),
  constraint receipts_created_by_fkey foreign KEY (created_by) references users (id),
  constraint receipts_group_id_fkey foreign KEY (group_id) references groups (id) on delete CASCADE
) TABLESPACE pg_default;
