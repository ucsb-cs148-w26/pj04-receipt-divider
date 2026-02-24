create table public.users (
  -- TODO: change to user_id
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  email text null default ''::text,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email)
) TABLESPACE pg_default;


CREATE OR REPLACE FUNCTION auto_create_new_user_public_info()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users_public_info (user_id, name, accent_color)
  VALUES (
    NEW.id,
    SPLIT_PART(COALESCE(NEW.email, NEW.id::text), '@', 1), -- use email prefix or id as default name
    '#' || SUBSTRING(MD5(NEW.id::text), 1, 6)              -- hex color from hash of user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
AFTER INSERT ON users FOR EACH ROW
EXECUTE FUNCTION auto_create_new_user_public_info();
