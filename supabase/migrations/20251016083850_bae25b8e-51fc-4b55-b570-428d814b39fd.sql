-- ==========================================
-- YouTube Auto-Comment System - Cron Jobs
-- ==========================================
-- Crea i cron job mancanti per il sistema di auto-commenti YouTube

-- 1. Job Creator - Ogni ora cerca nuovi video YouTube e crea job di commento
SELECT cron.schedule(
  'youtube-job-creator-hourly',
  '0 * * * *', -- Ogni ora al minuto 0
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-job-creator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron_hourly"}'::jsonb
  ) as request_id;
  $$
);

-- 2. Comment Processor - Ogni 5 minuti processa i job in coda
SELECT cron.schedule(
  'youtube-auto-comment-processor',
  '*/5 * * * *', -- Ogni 5 minuti
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-auto-comment',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron_processor"}'::jsonb
  ) as request_id;
  $$
);

-- 3. Comments Scheduler - Ogni giorno alle 00:05 schedula i commenti per la giornata
SELECT cron.schedule(
  'youtube-comments-scheduler-daily',
  '5 0 * * *', -- Ogni giorno alle 00:05
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/comments-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron_scheduler"}'::jsonb
  ) as request_id;
  $$
);

-- 4. Token Refresh - Ogni 50 minuti rinnova il token OAuth YouTube
SELECT cron.schedule(
  'youtube-token-refresh',
  '*/50 * * * *', -- Ogni 50 minuti
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-refresh-token',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron_token_refresh"}'::jsonb
  ) as request_id;
  $$
);

-- Log della creazione
DO $$
BEGIN
  RAISE NOTICE 'YouTube auto-comment cron jobs created successfully';
  RAISE NOTICE '1. youtube-job-creator-hourly - Runs every hour';
  RAISE NOTICE '2. youtube-auto-comment-processor - Runs every 5 minutes';  
  RAISE NOTICE '3. youtube-comments-scheduler-daily - Runs daily at 00:05';
  RAISE NOTICE '4. youtube-token-refresh - Runs every 50 minutes';
END $$;