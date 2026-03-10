-- Migration: add nullable tax column to receipts table
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS tax real;
