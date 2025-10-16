-- Delete all queued YouTube comment jobs to reset the system
DELETE FROM social_comment_jobs 
WHERE status = 'queued' 
AND platform = 'youtube';