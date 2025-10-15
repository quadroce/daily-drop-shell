-- Fix reset_stuck_comment_jobs function to return count instead of rows
DROP FUNCTION IF EXISTS public.reset_stuck_comment_jobs();

CREATE OR REPLACE FUNCTION public.reset_stuck_comment_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset jobs stuck in processing for more than 10 minutes
  WITH updated AS (
    UPDATE social_comment_jobs
    SET status = 'queued',
        tries = tries + 1,
        last_error = 'Auto-reset: stuck in processing'
    WHERE status = 'processing'
      AND created_at < NOW() - INTERVAL '10 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO reset_count FROM updated;
  
  RETURN COALESCE(reset_count, 0);
END;
$$;

-- Setup cron job for comments scheduler (runs daily at 8:00 AM CET)
SELECT cron.schedule(
  'comments-scheduler-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/comments-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Setup cron job for auto-comment processor (runs every 30 minutes)
SELECT cron.schedule(
  'youtube-auto-comment-processor',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-auto-comment',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Reset the stuck jobs now
UPDATE social_comment_jobs
SET status = 'queued',
    tries = tries + 1,
    last_error = 'Manual reset: stuck in processing'
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';