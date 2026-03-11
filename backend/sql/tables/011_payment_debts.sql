-- 011_payment_debts.sql
--
-- Replaces the single paid_status column on group_members with a per-pair
-- payment_debts table.  Each row represents one debt relationship within a
-- group: debtor_id owes creditor_id money (for items claimed from that
-- creditor's uploaded receipts).  The amount is always derived at query time
-- from item_claims; only the status is stored here.
--
-- Status semantics (same enum as before):
--   unrequested – creditor has not yet asked for payment
--   requested   – creditor has asked debtor to pay
--   pending     – debtor self-reports they have paid; awaiting creditor verification
--   verified    – creditor confirms receipt of payment

-- ── New table ─────────────────────────────────────────────────────────────────

CREATE TABLE public.payment_debts (
  group_id    uuid               NOT NULL,
  debtor_id   uuid               NOT NULL,
  creditor_id uuid               NOT NULL,
  paid_status paid_status_enum   NOT NULL DEFAULT 'unrequested',
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_debts_pkey
    PRIMARY KEY (group_id, debtor_id, creditor_id),
  CONSTRAINT payment_debts_no_self_debt
    CHECK (debtor_id <> creditor_id),
  CONSTRAINT payment_debts_group_id_fkey
    FOREIGN KEY (group_id)    REFERENCES groups(id)    ON DELETE CASCADE,
  CONSTRAINT payment_debts_debtor_id_fkey
    FOREIGN KEY (debtor_id)   REFERENCES profiles(id)  ON DELETE CASCADE,
  CONSTRAINT payment_debts_creditor_id_fkey
    FOREIGN KEY (creditor_id) REFERENCES profiles(id)  ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_payment_debts_debtor
  ON public.payment_debts (group_id, debtor_id);

CREATE INDEX IF NOT EXISTS idx_payment_debts_creditor
  ON public.payment_debts (group_id, creditor_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Any group member may read all debt records for that group.
-- All writes go through the FastAPI backend (service-role key bypasses RLS).

ALTER TABLE public.payment_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_debts_select_by_group_member"
  ON public.payment_debts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.profile_id = auth.uid()
        AND gm.group_id   = payment_debts.group_id
    )
  );

-- ── Migrate existing data ─────────────────────────────────────────────────────
-- For every group member who already has a non-unrequested paid_status,
-- create the corresponding debt row (member owes the group host).

INSERT INTO public.payment_debts (group_id, debtor_id, creditor_id, paid_status)
SELECT
  gm.group_id,
  gm.profile_id        AS debtor_id,
  g.created_by         AS creditor_id,
  gm.paid_status
FROM public.group_members gm
JOIN public.groups g ON g.id = gm.group_id
WHERE gm.profile_id <> g.created_by   -- host never owes themselves
ON CONFLICT DO NOTHING;

-- ── Drop old column ───────────────────────────────────────────────────────────

ALTER TABLE public.group_members DROP COLUMN IF EXISTS paid_status;
