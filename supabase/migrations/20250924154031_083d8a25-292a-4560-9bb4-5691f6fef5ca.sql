-- Restore the optimized background-feed-ranking cron job
SELECT cron.schedule(
  'background-feed-ranking-optimized',
  '0 6,14,22 * * *', -- Run 3 times daily at 6:00, 14:00, 22:00
  $$
  SELECT
    net.http_post(
        url:='https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
        body:='{"trigger": "cron_optimized", "users_limit": 20, "smart_cache": true}'::jsonb
    ) as request_id;
  $$
);

-- Log the restoration action
INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
VALUES (
    NULL,
    'restore_cron_job',
    'cron',
    'background-feed-ranking-optimized',
    jsonb_build_object(
        'schedule', '0 6,14,22 * * *',
        'description', 'Restored optimized cron job after cleanup',
        'timestamp', now()
    )
);