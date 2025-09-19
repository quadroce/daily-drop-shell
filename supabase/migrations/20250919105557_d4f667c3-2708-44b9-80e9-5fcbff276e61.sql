-- Create a simplified version of the feed function
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
  image_url text,
  summary text,
  published_at timestamptz,
  language text,
  tags text[],
  l1_topic_id integer,
  l2_topic_id integer,
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
BEGIN
  -- Parse cursor if provided
  IF p_cursor IS NOT NULL THEN
    cursor_score := SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 1)::numeric;
    cursor_timestamp := SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 2);
    cursor_id := SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 3)::bigint;
  END IF;

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
    COALESCE(d.score::numeric, 0.5) as final_score,
    'Relevant content'::text as reason_for_ranking,
    d.youtube_video_id,
    d.youtube_channel_id,
    d.youtube_thumbnail_url,
    d.type
  FROM public.drops d
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
          WHEN cursor_timestamp = 'null' THEN '1970-01-01'::timestamptz
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.feed_get_page_drops TO authenticated;