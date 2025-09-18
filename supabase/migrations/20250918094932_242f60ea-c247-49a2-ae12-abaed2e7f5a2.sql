-- Aggiorna i cron jobs per sincronizzare newsletter e feed
-- Prima, rimuovi eventuali job esistenti per evitare duplicati
SELECT cron.unschedule('background-feed-ranking-daily');
SELECT cron.unschedule('newsletter-premium-daily-cron');  
SELECT cron.unschedule('newsletter-free-weekly-cron');

-- Crea il job per background-feed-ranking alle 6:00 UTC
SELECT cron.schedule(
  'background-feed-ranking-daily',
  '0 6 * * *', -- Ogni giorno alle 6:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  );
  $$
);

-- Crea newsletter premium daily alle 6:10 UTC (10 minuti dopo)
SELECT cron.schedule(
  'newsletter-premium-daily-cron',
  '10 6 * * *', -- Ogni giorno alle 6:10 UTC  
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-newsletters',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"cadence": "daily", "tier": "premium"}'::jsonb
  );
  $$
);

-- Crea newsletter free weekly alle 6:10 UTC del lunedì
SELECT cron.schedule(
  'newsletter-free-weekly-cron', 
  '10 6 * * 1', -- Ogni lunedì alle 6:10 UTC
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-newsletters', 
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"cadence": "weekly", "tier": "free"}'::jsonb  
  );
  $$
);