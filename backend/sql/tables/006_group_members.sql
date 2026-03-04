create table public.group_members (
  profile_id uuid not null,
  group_id uuid not null,
  joined_at timestamp with time zone not null default now(),
  constraint group_members_pkey primary key (profile_id, group_id),
  constraint group_members_group_id_fkey foreign KEY (group_id) references groups (id) on delete CASCADE,
  constraint group_members_profile_id_fkey foreign KEY (profile_id) references profiles (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_group_members_group_user on public.group_members using btree (group_id, profile_id) TABLESPACE pg_default;

CREATE OR REPLACE FUNCTION unclaim_items_on_member_leave()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM item_claims
    WHERE profile_id = OLD.profile_id
      AND item_id IN (
          SELECT id
          FROM items
          WHERE group_id = OLD.group_id
      );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

create trigger trg_unclaim_items_on_member_leave
after DELETE on group_members for EACH row
execute FUNCTION unclaim_items_on_member_leave ();
