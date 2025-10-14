-- Create cron jobs for YouTube Shorts automation

-- 1. Daily scheduler: Creates jobs for the next day (runs at 8:00 AM CET)
SELECT cron.schedule(
  'youtube-shorts-scheduler',
  '0 7 * * *', -- 7:00 UTC = 8:00 CET (winter) / 9:00 CEST (summer), adjust to 6:00 UTC for consistent 8:00 CET
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- 2. Hourly processor: Publishes scheduled shorts (runs every 30 minutes)
SELECT cron.schedule(
  'youtube-shorts-processor',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-shorts-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Store the weekly rotation configuration in app_settings
INSERT INTO app_settings (key, value, updated_at)
VALUES (
  'shorts_weekly_rotation',
  jsonb_build_object(
    'timezone', 'Europe/Rome',
    'slots', jsonb_build_array(
      jsonb_build_object('slot', 1, 'time', '11:15', 'type', 'recap'),
      jsonb_build_object('slot', 2, 'time', '17:45', 'type', 'highlight')
    ),
    'rotation', jsonb_build_object(
      '1', jsonb_build_array('ai-ml', 'ai-applications'),
      '2', jsonb_build_array('cloud-devops', 'cybersecurity'),
      '3', jsonb_build_array('data-analytics', 'fintech'),
      '4', jsonb_build_array('crypto-blockchain', 'backend'),
      '5', jsonb_build_array('frontend', 'hardware-gadgets'),
      '6', jsonb_build_array('startups-venture', 'product-management'),
      '0', jsonb_build_array('marketing-growth', 'content-marketing')
    )
  ),
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();