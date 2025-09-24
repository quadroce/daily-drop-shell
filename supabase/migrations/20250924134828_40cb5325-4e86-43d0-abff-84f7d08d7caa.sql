-- Extend source_health table for zero article tracking and auto-elimination
ALTER TABLE public.source_health 
ADD COLUMN IF NOT EXISTS zero_article_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_zero_attempt_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of sources by zero attempts and productivity
CREATE INDEX IF NOT EXISTS idx_source_health_zero_attempts 
ON public.source_health(zero_article_attempts, last_zero_attempt_at);

-- Create index for source prioritization queries
CREATE INDEX IF NOT EXISTS idx_source_health_active_priority 
ON public.source_health(source_id, is_paused, zero_article_attempts) 
WHERE NOT is_paused;

-- Update existing records to have default values
UPDATE public.source_health 
SET zero_article_attempts = 0 
WHERE zero_article_attempts IS NULL;