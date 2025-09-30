-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove existing cron job if it exists (ignore errors if not found)
DO $$
BEGIN
  PERFORM cron.unschedule('send-onboarding-reminders-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Job doesn't exist or other error, that's fine
END $$;

-- Schedule onboarding reminders to run daily at 9:00 UTC
SELECT cron.schedule(
  'send-onboarding-reminders-daily',
  '0 9 * * *', -- Every day at 9:00 UTC
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-onboarding-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := jsonb_build_object(
        'trigger', 'cron',
        'timestamp', now()
      )
    ) AS request_id;
  $$
);