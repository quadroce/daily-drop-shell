-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove existing cron job if exists
SELECT cron.unschedule('youtube-auto-comment-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'youtube-auto-comment-job'
);

-- Create cron job to run youtube-auto-comment every 5 minutes
SELECT cron.schedule(
  'youtube-auto-comment-job',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-auto-comment',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Log the cron job creation
INSERT INTO cron_execution_log (job_name, success, response_body)
VALUES ('youtube-auto-comment-job', true, 'Cron job created successfully');