-- Create email-ready drops view with safe fallbacks
CREATE OR REPLACE VIEW public.drops_email_ready AS
SELECT
  d.id,
  d.url,
  -- Safe title fallback: trim title, fallback to original_title, then hostname
  COALESCE(
    NULLIF(BTRIM(d.title), ''),
    INITCAP(SPLIT_PART(d.url, '/', 3))
  ) AS title_safe,
  -- Safe date: published_at or created_at
  CASE 
    WHEN d.published_at IS NOT NULL THEN d.published_at 
    ELSE d.created_at 
  END AS date_safe,
  -- Safe image URL (cleaned)
  NULLIF(BTRIM(d.image_url), '') AS image_url,
  -- Source name with fallback
  COALESCE(s.name, 'Unknown Source') AS source_name,
  d.tags,
  d.summary,
  d.type,
  d.lang_code,
  d.youtube_video_id,
  d.created_at,
  d.published_at
FROM public.drops d
LEFT JOIN public.sources s ON d.source_id = s.id
WHERE d.tag_done = true;