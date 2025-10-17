
-- Create cron job for YouTube Shorts scheduler (runs daily at 8 PM to create next day's jobs)
SELECT cron.schedule(
  'youtube-shorts-scheduler-daily',
  '0 20 * * *', -- Every day at 20:00 (8 PM)
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Create cron job for YouTube Shorts processor (runs every 30 minutes to process ready jobs)
SELECT cron.schedule(
  'youtube-shorts-processor-30min',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Insert tracking records
INSERT INTO cron_jobs (name, enabled) VALUES 
  ('youtube-shorts-scheduler', true),
  ('youtube-shorts-processor', true)
ON CONFLICT (name) DO UPDATE SET enabled = true;

-- Log the setup
INSERT INTO cron_execution_log (job_name, success, response_body)
VALUES ('youtube-shorts-scheduler', true, '{"message": "Cron jobs configured", "scheduler": "20:00 daily", "processor": "every 30 min"}');
