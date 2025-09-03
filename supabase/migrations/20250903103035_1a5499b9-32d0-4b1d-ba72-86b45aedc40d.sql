-- Create automated recovery cron job that runs every 15 minutes
SELECT cron.schedule(
  'automated-ingestion-recovery',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/restart-ingestion',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{"auto_recovery": true}'::jsonb
    ) as request_id;
  $$
);

-- Create main processing cron job that runs every 10 minutes
SELECT cron.schedule(
  'auto-ingest-worker-v2',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/restart-ingestion',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{"cron_trigger": true}'::jsonb
    ) as request_id;
  $$
);