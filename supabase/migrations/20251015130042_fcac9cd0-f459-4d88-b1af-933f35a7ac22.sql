-- Drop existing YouTube job creator cron jobs if they exist
DO $$
BEGIN
  PERFORM cron.unschedule('youtube-job-creator-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('youtube-job-creator-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create hourly cron job for YouTube job creator (runs every hour)
SELECT cron.schedule(
  'youtube-job-creator-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-job-creator',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron_hourly"}'::jsonb
    ) as request_id;
  $$
);

-- Create daily cron job for YouTube job creator (runs once per day at 3 AM)
SELECT cron.schedule(
  'youtube-job-creator-daily',
  '0 3 * * *', -- Every day at 3 AM
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-job-creator',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron_daily"}'::jsonb
    ) as request_id;
  $$
);