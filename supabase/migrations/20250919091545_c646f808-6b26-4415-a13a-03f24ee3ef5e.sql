-- Create cron job for onboarding reminders (daily at 09:00 UTC)
SELECT cron.schedule(
  'onboarding-reminders-daily',
  '0 9 * * *', -- Every day at 09:00 UTC (11:00 CET)
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-onboarding-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"trigger": "cron", "timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- Insert the cron job record for UI tracking
INSERT INTO public.cron_jobs (name, enabled) 
VALUES ('onboarding-reminders-daily', true)
ON CONFLICT (name) DO UPDATE SET enabled = true;