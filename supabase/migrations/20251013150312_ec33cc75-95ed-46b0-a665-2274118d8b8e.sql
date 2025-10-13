-- Reset stuck processing job
UPDATE social_comment_jobs 
SET status = 'queued', tries = tries + 1 
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Create function to auto-reset stuck jobs
CREATE OR REPLACE FUNCTION reset_stuck_comment_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset jobs stuck in processing for more than 10 minutes
  UPDATE social_comment_jobs
  SET status = 'queued',
      tries = tries + 1,
      last_error = 'Auto-reset: stuck in processing'
  WHERE status = 'processing'
    AND created_at < NOW() - INTERVAL '10 minutes'
  RETURNING id INTO reset_count;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;