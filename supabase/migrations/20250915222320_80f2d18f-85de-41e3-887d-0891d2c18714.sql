-- Reset stuck queue items that have been processing for more than 30 minutes
UPDATE public.ingestion_queue 
SET status = 'pending', tries = 0, error = null 
WHERE status = 'processing' 
AND created_at < (now() - interval '30 minutes');

-- Create admin function to get ingestion health status
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
AS $function$
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
$function$;