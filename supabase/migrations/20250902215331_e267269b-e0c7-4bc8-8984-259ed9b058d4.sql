-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- First, remove any existing cron job with the same name
SELECT cron.unschedule('automated-ingestion-hourly');

-- Create hourly cron job for automated ingestion
SELECT cron.schedule(
  'automated-ingestion-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:=concat('{"trigger": "cron_hourly", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'automated-ingestion-hourly';