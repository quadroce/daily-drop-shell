-- Create a single test job for YouTube OAuth test
INSERT INTO public.social_comment_jobs (
  video_id,
  channel_id,
  video_title,
  video_description,
  topic_slug,
  text_hash,
  utm_campaign,
  utm_content,
  status,
  platform,
  locale
) VALUES (
  'dQw4w9WgXcQ',  -- Rick Astley - Never Gonna Give You Up (safe test video)
  'UCuAXFkgsw1L7xaCfnd5JJOw',
  'Test Video for DailyDrops OAuth',
  'This is a test comment to verify YouTube API integration',
  'technology',
  md5('oauth-test-' || now()::text),
  'oauth-test-20251007',
  'oauth-test',
  'queued',
  'youtube',
  'en'
)
RETURNING id, video_id, video_title, status;