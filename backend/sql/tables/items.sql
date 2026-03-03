CREATE TABLE public.items (
  -- TODO: change to item_id
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NULL,
  name text NOT NULL,
  amount smallint NOT NULL,
  unit_price real NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  group_id uuid NOT NULL,
  constraint items_pkey primary key (id),
  constraint items_group_id_fkey foreign KEY (group_id) references groups (id) on update CASCADE on delete CASCADE,
  constraint items_receipt_id_fkey foreign KEY (receipt_id) references receipts (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
