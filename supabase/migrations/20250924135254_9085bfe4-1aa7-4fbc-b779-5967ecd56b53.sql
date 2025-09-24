-- Create new cron job to run fetch-rss every 30 minutes for increased ingestion frequency
SELECT cron.schedule(
  'fetch-rss-frequent',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/automated-ingestion',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"trigger": "cron_frequent"}'::jsonb
    ) as request_id;
  $$
);

-- Create a function to manually clean up sources with 3+ zero article attempts
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sources()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    disabled_count INTEGER := 0;
BEGIN
    -- Only allow admin users to run this
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Only admins can cleanup inactive sources';
    END IF;

    -- Disable sources that have failed to produce articles 3+ times
    UPDATE public.sources 
    SET status = 'disabled'
    FROM public.source_health
    WHERE sources.id = source_health.source_id
    AND source_health.zero_article_attempts >= 3
    AND sources.status = 'active';
    
    GET DIAGNOSTICS disabled_count = ROW_COUNT;
    
    -- Log the cleanup action
    INSERT INTO public.admin_audit_log (user_id, action, resource_type, details)
    VALUES (
        auth.uid(), 
        'cleanup_inactive_sources', 
        'source',
        jsonb_build_object('disabled_count', disabled_count)
    );
    
    RETURN disabled_count;
END;
$$;