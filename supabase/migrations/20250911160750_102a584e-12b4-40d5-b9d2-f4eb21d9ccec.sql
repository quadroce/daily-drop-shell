-- Modify user_feed_cache table to use 24-hour expiration
ALTER TABLE public.user_feed_cache 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Create a cron job to run background feed ranking every 24 hours at 6:00 AM
SELECT cron.schedule(
  'daily-feed-ranking',
  '0 6 * * *', -- Every day at 6:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Update existing cache entries to use the new 24-hour expiration
UPDATE public.user_feed_cache 
SET expires_at = created_at + interval '24 hours'
WHERE expires_at < now() + interval '24 hours';