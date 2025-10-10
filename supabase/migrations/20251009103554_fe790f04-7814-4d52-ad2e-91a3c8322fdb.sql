-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule youtube-job-creator to run daily at 9:00 AM
-- This automatically creates comment jobs for new YouTube videos
SELECT cron.schedule(
  'youtube-job-creator-daily',
  '0 9 * * *', -- Every day at 9:00 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-job-creator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron_daily"}'::jsonb
  ) as request_id;
  $$
);

-- Log the cron job creation
INSERT INTO cron_execution_log (job_name, success, executed_at, response_body)
VALUES ('youtube-job-creator-daily', true, NOW(), 'Cron job scheduled successfully - runs daily at 9:00 AM UTC');

-- Add entry to cron_jobs table for tracking
INSERT INTO cron_jobs (name, enabled, created_at, updated_at)
VALUES ('youtube-job-creator-daily', true, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  enabled = true,
  updated_at = NOW();