-- Create storage bucket for public sitemaps
INSERT INTO storage.buckets (id, name, public) 
VALUES ('public-sitemaps', 'public-sitemaps', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for public sitemap access
CREATE POLICY "Public sitemap read access" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'public-sitemaps');

-- Create sequence for sitemap_runs table
CREATE SEQUENCE IF NOT EXISTS public.sitemap_runs_id_seq;

-- Create table to track sitemap generation runs
CREATE TABLE public.sitemap_runs (
  id bigint PRIMARY KEY DEFAULT nextval('sitemap_runs_id_seq'::regclass),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  success boolean DEFAULT false,
  error_message text,
  total_urls integer DEFAULT 0,
  topics_count integer DEFAULT 0,
  archive_urls_count integer DEFAULT 0,
  google_ping_success boolean DEFAULT false,
  bing_ping_success boolean DEFAULT false
);

-- Enable RLS on sitemap_runs
ALTER TABLE public.sitemap_runs ENABLE ROW LEVEL SECURITY;

-- Only admins can read sitemap run logs
CREATE POLICY "Admin read sitemap runs" 
ON public.sitemap_runs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Create daily cron job for sitemap generation (4:00 UTC)
SELECT cron.schedule(
  'daily-sitemap-generation',
  '0 4 * * *', -- Every day at 4:00 UTC
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/generate-sitemap',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);