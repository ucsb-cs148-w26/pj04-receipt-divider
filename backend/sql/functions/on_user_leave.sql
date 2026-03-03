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
