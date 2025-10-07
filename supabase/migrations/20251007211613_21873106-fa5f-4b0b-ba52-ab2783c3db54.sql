-- Update existing jobs to use correct domain
UPDATE social_comment_jobs
SET text_original = REPLACE(text_original, 'dailydrops.info', 'dailydrops.cloud')
WHERE text_original LIKE '%dailydrops.info%';