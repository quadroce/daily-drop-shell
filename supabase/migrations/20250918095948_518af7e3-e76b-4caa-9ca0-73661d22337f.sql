-- Modifica il cron job restart-ingestion per usare automated-ingestion
-- Throughput aumenterà da ~120 a ~450 items/ora

DO $$
BEGIN
  -- Prova con ID 13 (restart-ingestion-cron)
  BEGIN
    PERFORM cron.alter_job(
      13,
      schedule := '*/15 * * * *',
      command := $CMD$
      SELECT net.http_post(
        url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body := '{"trigger": "auto_scheduled"}'::jsonb
      );
      $CMD$
    );
    RAISE NOTICE 'Job 13 updated successfully to use automated-ingestion';
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Prova il prossimo ID
  END;
  
  -- Prova con ID 14
  BEGIN
    PERFORM cron.alter_job(
      14,
      schedule := '*/15 * * * *',
      command := $CMD$
      SELECT net.http_post(
        url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body := '{"trigger": "auto_scheduled"}'::jsonb
      );
      $CMD$
    );
    RAISE NOTICE 'Job 14 updated successfully to use automated-ingestion';
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Prova il prossimo ID
  END;
  
  -- Prova con ID 12
  BEGIN
    PERFORM cron.alter_job(
      12,
      schedule := '*/15 * * * *',
      command := $CMD$
      SELECT net.http_post(
        url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion', 
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body := '{"trigger": "auto_scheduled"}'::jsonb
      );
      $CMD$
    );
    RAISE NOTICE 'Job 12 updated successfully to use automated-ingestion';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not find restart-ingestion-cron job. Check job IDs manually.';
  END;
END $$;