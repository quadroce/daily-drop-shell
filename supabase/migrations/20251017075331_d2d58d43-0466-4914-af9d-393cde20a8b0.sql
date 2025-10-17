
-- Mark jobs with more than 5 retries as permanently failed
UPDATE social_comment_jobs
SET 
  status = 'failed',
  last_error = CONCAT('Max retries (5) exceeded. Last error: ', COALESCE(last_error, 'Unknown error'))
WHERE tries > 5 
  AND status IN ('error', 'queued', 'processing')
