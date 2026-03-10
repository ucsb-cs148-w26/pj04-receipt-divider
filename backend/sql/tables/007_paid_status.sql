-- Create the paid_status enum type
CREATE TYPE paid_status_enum AS ENUM ('verified', 'pending', 'requested', 'unrequested');

-- Add paid_status column to group_members table (default: unrequested)
ALTER TABLE public.group_members
ADD COLUMN paid_status paid_status_enum NOT NULL DEFAULT 'unrequested';
