-- Evolve engagement_events table for consolidated feedback tracking

-- First, remove duplicate feedback entries (keep the latest one)
DELETE FROM public.engagement_events 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, drop_id, action) id
    FROM public.engagement_events
    WHERE action IN ('like','dislike','save','dismiss')
    ORDER BY user_id, drop_id, action, created_at DESC
);

-- Add CHECK constraint for valid actions (only if it doesn't already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_actions' 
        AND table_name = 'engagement_events'
    ) THEN
        ALTER TABLE public.engagement_events 
        ADD CONSTRAINT valid_actions 
        CHECK (action IN ('open','like','dislike','save','dismiss','view','click'));
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_user_action ON public.engagement_events(user_id, action);
CREATE INDEX IF NOT EXISTS idx_engagement_drop_recent ON public.engagement_events(drop_id, created_at DESC);

-- Add unique constraint to prevent spam of the same feedback action
-- Only for feedback actions, not for tracking actions like 'view', 'click'
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_unique_feedback 
ON public.engagement_events(user_id, drop_id, action) 
WHERE action IN ('like','dislike','save','dismiss');

-- Add composite index for user profile refresh queries
CREATE INDEX IF NOT EXISTS idx_engagement_user_recent 
ON public.engagement_events(user_id, created_at DESC) 
WHERE action IN ('like','dislike','save','dismiss','open');