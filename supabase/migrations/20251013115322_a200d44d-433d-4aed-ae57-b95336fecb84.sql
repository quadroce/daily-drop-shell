-- Step 1: Clean up existing duplicates by keeping only the most recent job per video
-- Delete all but the most recent job for each video
DELETE FROM social_comment_jobs
WHERE id NOT IN (
  SELECT DISTINCT ON (video_id) id
  FROM social_comment_jobs
  ORDER BY video_id, created_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE social_comment_jobs 
ADD CONSTRAINT social_comment_jobs_video_id_unique 
UNIQUE (video_id);

-- Log the cleanup
DO $$ 
BEGIN 
  RAISE NOTICE 'Cleaned up duplicate YouTube comment jobs and added unique constraint';
END $$;