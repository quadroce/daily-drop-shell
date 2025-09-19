-- Update feed function to include source name and all topic tags
CREATE OR REPLACE FUNCTION public.feed_get_page_drops(
  p_user_id uuid,
  p_limit int DEFAULT 30,
  p_cursor text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_l1 integer DEFAULT NULL,
  p_l2 integer DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  title text,
  url text,
  source_id bigint,
  source_name text,
  image_url text,
  summary text,
  published_at timestamptz,
  language text,
  tags text[],
  l1_topic_id integer,
  l1_topic_label text,
  l1_topic_slug text,
  l2_topic_id integer, 
  l2_topic_label text,
  l2_topic_slug text,
  final_score numeric,
  reason_for_ranking text,
  youtube_video_id text,
  youtube_channel_id text,
  youtube_thumbnail_url text,
  type drop_type
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cursor_score numeric;
  cursor_timestamp text;
  cursor_id bigint;
  user_has_prefs boolean;
  user_topic_match boolean;
BEGIN
  -- Parse cursor if provided
  IF p_cursor IS NOT NULL THEN
    cursor_score := SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 1)::numeric;
    cursor_timestamp := SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 2);
    cursor_id := SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 3)::bigint;
  END IF;

  -- Check if user has preferences
  SELECT EXISTS(
    SELECT 1 FROM public.preferences p 
    WHERE p.user_id = p_user_id 
    AND array_length(p.selected_topic_ids, 1) > 0
  ) INTO user_has_prefs;

  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.url,
    d.source_id,
    COALESCE(s.name, 'Unknown Source') as source_name,
    d.image_url,
    d.summary,
    d.published_at,
    d.language,
    d.tags,
    d.l1_topic_id,
    l1_topic.label as l1_topic_label,
    l1_topic.slug as l1_topic_slug,
    d.l2_topic_id,
    l2_topic.label as l2_topic_label, 
    l2_topic.slug as l2_topic_slug,
    COALESCE(d.score::numeric, 0.5) as final_score,
    CASE 
      WHEN NOT user_has_prefs THEN 'Trending content'
      WHEN EXISTS(
        SELECT 1 FROM public.preferences pref
        JOIN unnest(pref.selected_topic_ids) AS topic_id ON true
        WHERE pref.user_id = p_user_id
        AND (topic_id = d.l1_topic_id OR topic_id = d.l2_topic_id)
      ) THEN 'Matches your interests'
      WHEN d.score >= 0.7 THEN 'High quality content'
      WHEN d.published_at >= (now() - interval '24 hours') THEN 'Fresh content'
      ELSE 'Relevant content'
    END as reason_for_ranking,
    d.youtube_video_id,
    d.youtube_channel_id,
    d.youtube_thumbnail_url,
    d.type
  FROM public.drops d
  LEFT JOIN public.sources s ON d.source_id = s.id
  LEFT JOIN public.topics l1_topic ON d.l1_topic_id = l1_topic.id
  LEFT JOIN public.topics l2_topic ON d.l2_topic_id = l2_topic.id
  WHERE d.tag_done = true
    AND (p_language IS NULL OR d.language = p_language)
    AND (p_l1 IS NULL OR d.l1_topic_id = p_l1)
    AND (p_l2 IS NULL OR d.l2_topic_id = p_l2)
    AND (
      p_cursor IS NULL
      OR (
        COALESCE(d.score::numeric, 0.5),
        COALESCE(d.published_at, '1970-01-01'::timestamptz),
        d.id
      ) < (
        cursor_score,
        CASE 
          WHEN cursor_timestamp = 'null' OR cursor_timestamp IS NULL THEN '1970-01-01'::timestamptz
          ELSE cursor_timestamp::timestamptz
        END,
        cursor_id
      )
    )
  ORDER BY 
    COALESCE(d.score::numeric, 0.5) DESC, 
    COALESCE(d.published_at, '1970-01-01'::timestamptz) DESC, 
    d.id DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;