CREATE TABLE public.group_members (
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  constraint group_members_pkey primary key (user_id, group_id),
  constraint group_members_group_id_fkey foreign KEY (group_id) references groups (id) ON DELETE CASCADE,
  constraint group_members_user_id_fkey foreign KEY (user_id) references users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON public.group_members using btree (group_id, user_id) TABLESPACE pg_default;

CREATE OR REPLACE FUNCTION unclaim_items_on_member_leave()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM item_claims
    WHERE user_id = OLD.user_id
      AND item_id IN (
          SELECT id
          FROM items
          WHERE group_id = OLD.group_id
      );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unclaim_items_on_member_leave
AFTER DELETE ON group_members FOR EACH ROW
EXECUTE FUNCTION unclaim_items_on_member_leave();
