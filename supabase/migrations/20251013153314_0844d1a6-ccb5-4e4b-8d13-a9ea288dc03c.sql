-- Remove duplicate cron job for YouTube job creation
SELECT cron.unschedule('auto-create-youtube-comment-jobs');