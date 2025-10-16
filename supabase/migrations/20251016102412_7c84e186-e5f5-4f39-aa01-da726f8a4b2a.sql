
-- Add missing cron job for comments-scheduler
-- Runs daily at 00:05 Europe/Rome
SELECT cron.schedule(
  'youtube-comments-scheduler-daily',
  '5 0 * * *',  -- 00:05 every day
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/comments-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"time": "daily-scheduler"}'::jsonb
    ) as request_id;
  $$
);

-- Insert into cron_jobs table for UI visibility
INSERT INTO cron_jobs (name, enabled)
VALUES ('youtube-comments-scheduler-daily', true)
ON CONFLICT (name) DO UPDATE SET enabled = true;
