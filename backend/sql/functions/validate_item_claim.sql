CREATE OR REPLACE FUNCTION validate_item_claim()
RETURNS TRIGGER AS $$
DECLARE
    total_share FLOAT;
    item_amount INT;
BEGIN
    -- Get the item amount
    SELECT amount INTO item_amount
    FROM items
    WHERE id = NEW.item_id;

    -- Sum all existing shares for this item, excluding the current user's claim
    SELECT COALESCE(SUM(share), 0) INTO total_share
    FROM item_claims
    WHERE item_id = NEW.item_id
    AND user_id != NEW.user_id;

    -- Check if adding the new share would exceed the item amount
    IF total_share + NEW.share > item_amount THEN
        RAISE EXCEPTION 'Claim share exceeds available amount. Available: %, Requested: %',
            item_amount - total_share, NEW.share;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER check_claim_share
BEFORE INSERT OR UPDATE ON item_claims
FOR EACH ROW
EXECUTE FUNCTION validate_claim_share();
