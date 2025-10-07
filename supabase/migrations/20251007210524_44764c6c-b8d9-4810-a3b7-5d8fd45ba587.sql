-- Create cron job to auto-create YouTube comment jobs every hour
SELECT cron.schedule(
  'youtube-job-creator-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-job-creator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Insert into cron_jobs tracking table
INSERT INTO cron_jobs (name, enabled) 
VALUES ('youtube-job-creator-hourly', true)
ON CONFLICT (name) DO NOTHING;