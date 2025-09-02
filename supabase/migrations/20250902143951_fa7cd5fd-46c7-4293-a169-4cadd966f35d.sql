-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create automatic ingest worker cron job (every 5 minutes)
SELECT cron.schedule(
  'auto-ingest-worker',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/ingest-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"limit": 50, "auto": true}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to manage cron job status
CREATE TABLE IF NOT EXISTS public.cron_jobs (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the auto-ingest job configuration
INSERT INTO public.cron_jobs (name, enabled) 
VALUES ('auto-ingest-worker', true)
ON CONFLICT (name) DO UPDATE SET updated_at = NOW();

-- Enable RLS for cron_jobs table
ALTER TABLE public.cron_jobs ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage cron jobs
CREATE POLICY "admin_manage_cron_jobs" ON public.cron_jobs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);