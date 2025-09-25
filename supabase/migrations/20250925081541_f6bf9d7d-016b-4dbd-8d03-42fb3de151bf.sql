-- Creazione del cron job per eseguire background-feed-ranking ogni giorno alle 6:00 AM UTC
SELECT cron.schedule(
  'background-feed-ranking-daily',
  '0 6 * * *', -- Alle 6:00 AM UTC ogni giorno
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  );
  $$
);

-- Verifica della cache rigenerata per l'utente
SELECT 
  COUNT(*) as cache_items,
  MAX(final_score) as max_score,
  MIN(expires_at) as earliest_expiry
FROM user_feed_cache 
WHERE user_id = '637fc77f-93aa-488a-a0e1-ebd00826d4b3';