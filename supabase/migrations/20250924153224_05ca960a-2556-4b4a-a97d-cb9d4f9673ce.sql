-- Fix conflicting cron jobs: disable old destructive ones, keep only optimized version
-- This prevents continuous cache deletion and ensures smart cache management

-- Disable the old hourly background-feed-ranking (destructive)
SELECT cron.unschedule('background-feed-ranking');

-- Disable other conflicting/duplicate ranking jobs  
SELECT cron.unschedule('daily-feed-ranking');
SELECT cron.unschedule('background-feed-ranking-12h');
SELECT cron.unschedule('feed-preload-smart');

-- Log the cleanup action (no user_id for system actions)
INSERT INTO admin_audit_log (action, resource_type, resource_id, details)
VALUES (
  'cron_cleanup',
  'system', 
  'cron_jobs',
  jsonb_build_object(
    'disabled_jobs', ARRAY['background-feed-ranking', 'daily-feed-ranking', 'background-feed-ranking-12h', 'feed-preload-smart'],
    'kept_jobs', ARRAY['background-feed-ranking-optimized'], 
    'reason', 'Fix conflicting cron jobs causing cache deletion',
    'timestamp', now()
  )
);