-- Migration: allow receipts without an image (manual receipts) and add is_manual flag
ALTER TABLE public.receipts ALTER COLUMN image DROP NOT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
