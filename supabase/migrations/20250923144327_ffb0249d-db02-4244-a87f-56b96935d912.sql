-- Create the missing feed_get_page_drops RPC function
CREATE OR REPLACE FUNCTION public.feed_get_page_drops(
  p_user_id uuid,
  p_cursor text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_l1 bigint DEFAULT NULL,
  p_l2 bigint DEFAULT NULL,
  p_limit integer DEFAULT 30
) RETURNS TABLE(
  id bigint,
  title text,
  url text,
  image_url text,
  summary text,
  type drop_type,
  tags text[],
  source_id bigint,
  published_at timestamp with time zone,
  final_score numeric,
  reason_for_ranking text,
  source_name text,
  lang_code text,
  youtube_video_id text,
  youtube_thumbnail_url text,
  youtube_duration_seconds integer
) LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cache_exists boolean;
  cursor_position integer := 1;
  next_position integer;
BEGIN
  -- Parse cursor if provided
  IF p_cursor IS NOT NULL AND p_cursor != '' THEN
    cursor_position := COALESCE((p_cursor::jsonb->>'position')::integer, 1);
  END IF;
  
  -- Check if valid cache exists for this user
  SELECT EXISTS(
    SELECT 1 FROM user_feed_cache ufc
    WHERE ufc.user_id = p_user_id 
    AND ufc.expires_at > now()
  ) INTO cache_exists;
  
  -- If cache exists, use it
  IF cache_exists THEN
    RETURN QUERY
    SELECT 
      d.id,
      d.title,
      d.url,
      d.image_url,
      d.summary,
      d.type,
      d.tags,
      d.source_id,
      d.published_at,
      ufc.final_score,
      ufc.reason_for_ranking,
      COALESCE(s.name, 'Unknown Source') as source_name,
      d.lang_code,
      d.youtube_video_id,
      d.youtube_thumbnail_url,
      d.youtube_duration_seconds
    FROM user_feed_cache ufc
    INNER JOIN drops d ON d.id = ufc.drop_id
    LEFT JOIN sources s ON s.id = d.source_id
    WHERE ufc.user_id = p_user_id
    AND ufc.position >= cursor_position
    AND ufc.expires_at > now()
    ORDER BY ufc.position
    LIMIT p_limit;
  ELSE
    -- Fallback to real-time ranking (simplified version)
    RETURN QUERY
    SELECT 
      d.id,
      d.title,
      d.url,
      d.image_url,
      d.summary,
      d.type,
      d.tags,
      d.source_id,
      d.published_at,
      -- Calculate basic score in real-time
      (
        0.4 * calculate_recency_score(d.published_at) +
        0.3 * ((COALESCE(d.authority_score, 0.5) + COALESCE(d.quality_score, 0.5)) / 2) +
        0.3 * calculate_popularity_score(COALESCE(d.popularity_score, 0))
      )::numeric as final_score,
      CASE 
        WHEN EXTRACT(EPOCH FROM (now() - d.published_at)) / 3600 < 24 
        THEN 'Fresh content • Relevant to your interests'
        ELSE 'Relevant to your interests'
      END as reason_for_ranking,
      COALESCE(s.name, 'Unknown Source') as source_name,
      d.lang_code,
      d.youtube_video_id,
      d.youtube_thumbnail_url,
      d.youtube_duration_seconds
    FROM drops d
    LEFT JOIN sources s ON s.id = d.source_id
    WHERE d.tag_done = true
    AND d.published_at >= (now() - interval '30 days')
    -- Apply topic filtering if user has preferences
    AND (
      EXISTS (
        SELECT 1 FROM preferences p
        JOIN topics t ON t.id = ANY(p.selected_topic_ids)
        WHERE p.user_id = p_user_id
        AND (t.slug = ANY(d.tags) OR t.id = d.l1_topic_id OR t.id = d.l2_topic_id)
      )
      OR NOT EXISTS (
        SELECT 1 FROM preferences p
        WHERE p.user_id = p_user_id
        AND array_length(p.selected_topic_ids, 1) > 0
      )
    )
    ORDER BY 
      (
        0.4 * calculate_recency_score(d.published_at) +
        0.3 * ((COALESCE(d.authority_score, 0.5) + COALESCE(d.quality_score, 0.5)) / 2) +
        0.3 * calculate_popularity_score(COALESCE(d.popularity_score, 0))
      ) DESC,
      d.published_at DESC
    LIMIT p_limit
    OFFSET GREATEST(0, cursor_position - 1);
  END IF;
END;
$$;