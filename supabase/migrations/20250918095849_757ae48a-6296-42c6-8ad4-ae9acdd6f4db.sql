-- Prima controlliamo i cron jobs esistenti e poi modifichiamo quello di restart-ingestion
-- per usare automated-ingestion invece

-- Mostra tutti i cron jobs per identificare l'ID corretto
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;

-- Modifica il job restart-ingestion-cron per chiamare automated-ingestion
UPDATE cron.job 
SET command = $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "auto_scheduled"}'::jsonb
  );
$$
WHERE jobname = 'restart-ingestion-cron';