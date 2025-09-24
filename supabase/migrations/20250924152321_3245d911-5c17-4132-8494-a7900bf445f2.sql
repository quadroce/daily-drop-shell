-- Crea il nuovo cron job ottimizzato (3 volte al giorno invece che ogni ora)
SELECT cron.schedule(
  'background-feed-ranking-optimized',
  '0 6,14,22 * * *', -- 3 volte al giorno: 6:00, 14:00, 22:00
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"trigger": "cron_optimized", "smart_cache": true}'::jsonb
    ) as request_id;
  $$
);

-- Log della ottimizzazione
INSERT INTO admin_audit_log (user_id, action, resource_type, resource_id, details)
VALUES (
  NULL, 
  'cron_optimization', 
  'background_ranking', 
  'smart_cache_implementation',
  jsonb_build_object(
    'new_schedule', '3_times_daily',
    'times', '06:00, 14:00, 22:00',
    'features', '["smart_cache", "fallback_system", "performance_optimization"]',
    'reason', 'Prevent cache deletion and improve user feed reliability'
  )
);