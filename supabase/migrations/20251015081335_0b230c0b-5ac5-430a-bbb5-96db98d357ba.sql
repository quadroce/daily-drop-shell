-- Fix cron schedules for YouTube Shorts

-- Drop existing jobs
SELECT cron.unschedule('youtube-shorts-scheduler');
SELECT cron.unschedule('youtube-shorts-processor');

-- Recreate scheduler with correct timezone (6:00 UTC = 8:00 CEST, 7:00 CET)
SELECT cron.schedule(
  'youtube-shorts-scheduler',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Recreate processor (every 30 minutes)
SELECT cron.schedule(
  'youtube-shorts-processor',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);