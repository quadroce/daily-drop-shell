
-- Add cron job to process YouTube comments every 10 minutes
SELECT cron.schedule(
  'youtube-auto-comment-processor',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-auto-comment',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Track in cron_jobs table
INSERT INTO cron_jobs (name, enabled) 
VALUES ('youtube-auto-comment-processor', true)
ON CONFLICT (name) DO UPDATE SET enabled = true;
