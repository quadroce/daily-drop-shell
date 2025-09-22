-- Add new columns to topics table for RSS, sharing, following, and intro content
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS intro text,
ADD COLUMN IF NOT EXISTS allow_rss boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_share boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_follow boolean DEFAULT true;