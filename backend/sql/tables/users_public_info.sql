create table public.users_public_info (
  user_id uuid not null,
  name text not null,
  accent_color text not null,
  constraint users_public_info_pkey primary key (user_id),
  constraint users_public_info_user_id_fkey foreign KEY (user_id) references users (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
