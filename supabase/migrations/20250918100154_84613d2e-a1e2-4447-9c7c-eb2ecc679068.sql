-- Correggi il cron job restart-ingestion per usare automated-ingestion
-- con sintassi corretta per i delimitatori

-- Prova con ID 13 per restart-ingestion-cron
SELECT cron.alter_job(
  13,
  schedule := '*/15 * * * *',
  command := $cmd$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "auto_scheduled"}'::jsonb
  );
  $cmd$
);