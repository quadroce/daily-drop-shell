-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron jobs table to track job status  
CREATE TABLE IF NOT EXISTS public.cron_jobs (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cron_jobs table
ALTER TABLE public.cron_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access to cron jobs
CREATE POLICY "admin_manage_cron_jobs" 
ON public.cron_jobs 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Insert the automated ingestion job record
INSERT INTO public.cron_jobs (name, enabled) 
VALUES ('automated_content_ingestion', true) 
ON CONFLICT (name) DO NOTHING;

-- Schedule the automated content ingestion job to run every hour
SELECT cron.schedule(
  'automated_content_ingestion',
  '0 * * * *', -- At minute 0 of every hour
  $$
  SELECT
    net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := '{"trigger": "cron_hourly"}'::jsonb
    ) as request_id;
  $$
);