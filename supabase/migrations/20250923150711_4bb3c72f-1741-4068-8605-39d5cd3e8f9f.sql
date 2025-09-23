-- Recreate the missing feed_get_page_drops RPC
CREATE OR REPLACE FUNCTION public.feed_get_page_drops(
  p_user_id uuid,
  p_limit integer DEFAULT 30,
  p_cursor text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_l1 bigint DEFAULT NULL,
  p_l2 bigint DEFAULT NULL
)
RETURNS TABLE(
  id bigint,
  title text,
  url text,
  source_id bigint,
  image_url text,
  summary text,
  published_at timestamp with time zone,
  language text,
  tags text[],
  l1_topic_id integer,
  l2_topic_id integer,
  final_score numeric,
  reason_for_ranking text,
  youtube_video_id text,
  youtube_channel_id text,
  youtube_thumbnail_url text,
  source_name text,
  type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cache_expired_at timestamp with time zone;
BEGIN
  -- Check if we have valid cache for this user
  cache_expired_at := now() - interval '24 hours';
  
  -- First try to use cache
  IF EXISTS (
    SELECT 1 FROM user_feed_cache 
    WHERE user_id = p_user_id 
    AND created_at > cache_expired_at
    LIMIT 1
  ) THEN
    -- Use cache with position-based pagination
    RETURN QUERY
    SELECT 
      d.id,
      d.title,
      d.url,
      d.source_id,
      d.image_url,
      d.summary,
      d.published_at,
      d.language,
      d.tags,
      d.l1_topic_id,
      d.l2_topic_id,
      uc.final_score,
      uc.reason_for_ranking,
      d.youtube_video_id,
      d.youtube_channel_id,
      d.youtube_thumbnail_url,
      COALESCE(s.name, 'Unknown Source') as source_name,
      d.type::text
    FROM user_feed_cache uc
    INNER JOIN drops d ON uc.drop_id = d.id
    LEFT JOIN sources s ON d.source_id = s.id
    WHERE uc.user_id = p_user_id
      AND (p_language IS NULL OR d.language = p_language)
      AND (p_l1 IS NULL OR d.l1_topic_id = p_l1)
      AND (p_l2 IS NULL OR d.l2_topic_id = p_l2)
      AND (
        p_cursor IS NULL OR 
        uc.position > (
          SELECT COALESCE(
            (SELECT json_extract_path_text(p_cursor::json, 'position'))::integer,
            0
          )
        )
      )
    ORDER BY uc.position
    LIMIT p_limit;
    
    RETURN;
  END IF;

  -- Fallback: real-time ranking (simplified version)
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.url,
    d.source_id,
    d.image_url,
    d.summary,
    d.published_at,
    d.language,
    d.tags,
    d.l1_topic_id,
    d.l2_topic_id,
    COALESCE(
      (d.authority_score + d.quality_score + d.popularity_score) / 3.0,
      0.5
    )::numeric as final_score,
    'Relevant content'::text as reason_for_ranking,
    d.youtube_video_id,
    d.youtube_channel_id,
    d.youtube_thumbnail_url,
    COALESCE(s.name, 'Unknown Source') as source_name,
    d.type::text
  FROM drops d
  LEFT JOIN sources s ON d.source_id = s.id
  WHERE d.tag_done = true
    AND (p_language IS NULL OR d.language = p_language)
    AND (p_l1 IS NULL OR d.l1_topic_id = p_l1)
    AND (p_l2 IS NULL OR d.l2_topic_id = p_l2)
    AND d.published_at >= (now() - interval '7 days')
  ORDER BY d.published_at DESC
  LIMIT p_limit;
END;
$$;