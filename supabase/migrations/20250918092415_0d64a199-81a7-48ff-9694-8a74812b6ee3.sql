-- Set up cron jobs for newsletter automation
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Newsletter automation for Premium users (daily at 06:00 UTC = 08:00 Europe/Rome)
SELECT cron.schedule(
  'newsletter-premium-daily',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-newsletters',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron-daily"}'::jsonb
    ) as request_id;
  $$
);

-- Newsletter automation for Free users (weekly on Monday at 06:00 UTC = 08:00 Europe/Rome)  
SELECT cron.schedule(
  'newsletter-free-weekly',
  '0 6 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-newsletters',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron-weekly"}'::jsonb
    ) as request_id;
  $$
);

-- Insert cron job records for tracking
INSERT INTO public.cron_jobs (name, enabled) VALUES 
('newsletter-premium-daily', true),
('newsletter-free-weekly', true)
ON CONFLICT (name) DO UPDATE SET 
  enabled = EXCLUDED.enabled,
  updated_at = now();