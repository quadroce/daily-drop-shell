-- Cambia il cron job di ingestion automatico da restart-ingestion a automated-ingestion
-- per aumentare drasticamente il throughput (da ~120 a ~450 items/ora)

SELECT cron.alter_job(
  15, -- restart-ingestion-cron job ID
  schedule := '*/15 * * * *', -- ogni 15 minuti
  command := $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "auto_scheduled"}'::jsonb
  );
  $$
);