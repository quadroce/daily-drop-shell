-- Add unique constraint on (video_id, platform) to prevent duplicate jobs for same video
-- This ensures we never create multiple jobs for the same video

-- First, clean up any existing duplicate jobs (keep the oldest one for each video_id)
WITH ranked_jobs AS (
  SELECT id, video_id, platform, status,
         ROW_NUMBER() OVER (PARTITION BY video_id, platform ORDER BY created_at ASC) as rn
  FROM social_comment_jobs
  WHERE status IN ('queued', 'processing', 'error')
)
UPDATE social_comment_jobs
SET status = 'failed',
    last_error = 'Duplicate job - removed during cleanup'
WHERE id IN (
  SELECT id FROM ranked_jobs WHERE rn > 1
);

-- Add the unique constraint
-- Note: Only applies to active jobs (queued, processing, posted)
-- Failed jobs can have duplicates for retry purposes
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_comment_jobs_video_unique 
ON social_comment_jobs (video_id, platform) 
WHERE status IN ('queued', 'processing', 'posted', 'ready');

-- Add comment for documentation
COMMENT ON INDEX idx_social_comment_jobs_video_unique IS 
'Ensures only one active comment job exists per video. Prevents duplicate comments on the same video.';
