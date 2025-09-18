-- Cleanup: Remove sources without RSS feeds
-- These sources have 0 articles and 0 ingestion queue items, making them safe to delete

DELETE FROM public.sources 
WHERE feed_url IS NULL;

-- Log the cleanup action
INSERT INTO public.admin_audit_log (user_id, action, resource_type, resource_id, details)
VALUES (
  NULL,
  'bulk_delete', 
  'sources', 
  'cleanup_no_rss_feeds',
  jsonb_build_object(
    'reason', 'Sources without RSS feeds cleanup',
    'sources_deleted', (SELECT COUNT(*) FROM public.sources WHERE feed_url IS NULL),
    'migration_date', now()
  )
);