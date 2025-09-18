-- Update newsletter cron jobs timing to +10 minutes buffer after background-feed-ranking
-- This ensures newsletter uses the fresh user_feed_cache populated by background ranking

-- Drop existing cron jobs
SELECT cron.unschedule('newsletter-premium-daily');
SELECT cron.unschedule('newsletter-free-weekly');

-- Reschedule with +10 minutes buffer (06:10 UTC instead of 06:00 UTC)
-- Newsletter automation for Premium users (daily at 06:10 UTC = 08:10 Europe/Rome) 
SELECT cron.schedule(
  'newsletter-premium-daily',
  '10 6 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-newsletters',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron-daily"}'::jsonb
    ) as request_id;
  $$
);

-- Newsletter automation for Free users (weekly on Monday at 06:10 UTC = 08:10 Europe/Rome)  
SELECT cron.schedule(
  'newsletter-free-weekly',
  '10 6 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-newsletters',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron-weekly"}'::jsonb
    ) as request_id;
  $$
);