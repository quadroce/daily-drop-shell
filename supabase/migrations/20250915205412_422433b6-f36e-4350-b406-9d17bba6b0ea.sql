-- Clean up any existing cron jobs and set up proper ingestion scheduling
-- First, remove any existing cron jobs that might conflict
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('auto-ingest-worker-v2', 'automated-ingestion-recovery', 'restart-ingestion-cron');

-- Create a single, reliable cron job for ingestion every 15 minutes
-- This frequency is more reasonable than 10 minutes to avoid overwhelming the system
SELECT cron.schedule(
  'restart-ingestion-cron',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/restart-ingestion',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjcxODk4MiwiZXhwIjoyMDcyMjk0OTgyfQ.6kTZhbmm1_ACRNdgWJWFz4Z6UPXFYtb-ukYfXUa6-jA"}'::jsonb,
    body := '{"cron_trigger": true, "auto_recovery": true}'::jsonb
  );
  $$
);

-- Create a table to track cron job execution for monitoring
CREATE TABLE IF NOT EXISTS public.cron_execution_log (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  success boolean,
  response_status integer,
  response_body text,
  error_message text
);

-- Enable RLS on the new table
ALTER TABLE public.cron_execution_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin can access cron execution logs" ON public.cron_execution_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Update the existing cron_jobs table to reflect our single job
UPDATE public.cron_jobs 
SET name = 'restart-ingestion-cron', updated_at = now()
WHERE name = 'auto-ingest-worker';

-- Add a health check function to monitor ingestion status
CREATE OR REPLACE FUNCTION public.get_ingestion_health()
RETURNS TABLE(
  last_successful_run timestamp with time zone,
  minutes_since_last_run integer,
  is_healthy boolean,
  queue_size bigint,
  untagged_articles bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.cycle_timestamp as last_successful_run,
    EXTRACT(epoch FROM (now() - l.cycle_timestamp))::integer / 60 as minutes_since_last_run,
    CASE 
      WHEN EXTRACT(epoch FROM (now() - l.cycle_timestamp)) / 60 < 30 THEN true 
      ELSE false 
    END as is_healthy,
    (SELECT COUNT(*) FROM public.ingestion_queue WHERE status = 'pending') as queue_size,
    (SELECT COUNT(*) FROM public.drops WHERE tag_done = false) as untagged_articles
  FROM public.ingestion_logs l
  WHERE l.success = true
  ORDER BY l.cycle_timestamp DESC
  LIMIT 1;
END;
$$;