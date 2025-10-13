-- Add cron job to automatically create YouTube comment jobs every hour
-- This will check for new YouTube videos and create comment jobs automatically
SELECT cron.schedule(
  'auto-create-youtube-comment-jobs',
  '0 * * * *', -- Run every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-job-creator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "auto_cron"}'::jsonb
  ) as request_id;
  $$
);