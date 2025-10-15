-- Fix duplicate comment job (ID 129 that was processed 3 times)
UPDATE social_comment_jobs
SET 
  status = 'failed',
  last_error = 'Job was processed multiple times due to update error - marked as failed to prevent further duplicates',
  tries = 6
WHERE id = 129 AND status = 'processing';

-- Add a unique constraint to prevent multiple jobs for the same video
-- This will prevent the job creator from creating duplicate jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_video_job 
ON social_comment_jobs(video_id) 
WHERE status IN ('queued', 'processing', 'posted', 'ready');