create table public.profiles (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  email text null default ''::text,
  username text null,
  accent_color text null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email)
) TABLESPACE pg_default;

CREATE OR REPLACE FUNCTION pre_populate_profile_on_insert()
RETURNS trigger AS $$
BEGIN
  NEW.username := COALESCE(
    NEW.username,
    SPLIT_PART(COALESCE(NULLIF(NEW.email, '')), '@', 1),
    SUBSTRING(NEW.id::text, 1, 8)
  );

  NEW.accent_color := COALESCE(
    NULLIF(NEW.accent_color, ''),
    '#' || SUBSTRING(MD5(NEW.id::text), 1, 6)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

create trigger trg_pre_populate_profile_on_insert BEFORE INSERT on profiles for EACH row
execute FUNCTION pre_populate_profile_on_insert ();
