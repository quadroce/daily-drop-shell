-- Fix ambiguous column references in feed_get_page_drops function
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
  c_score numeric;
  c_published timestamptz;
  c_id bigint;
  decoded_timestamp text;
BEGIN
  -- Decode cursor if provided
  IF p_cursor IS NOT NULL THEN
    WITH decoded AS (
      SELECT
        SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 1)::numeric AS s,
        SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 2) AS t_str,
        SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 3)::bigint AS i
    )
    SELECT s, t_str, i INTO c_score, decoded_timestamp, c_id FROM decoded;
    
    -- Handle null timestamp properly
    IF decoded_timestamp = 'null' THEN
      c_published := NULL;
    ELSE
      c_published := decoded_timestamp::timestamptz;
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      d.id, d.title, d.url, d.source_id, d.image_url, d.summary,
      d.published_at, d.language, d.tags, d.l1_topic_id, d.l2_topic_id,
      COALESCE(uf.final_score, d.score::numeric) AS final_score,
      uf.reason_for_ranking,
      d.youtube_video_id, d.youtube_channel_id, d.youtube_thumbnail_url,
      d.type
    FROM public.drops d
    LEFT JOIN public.user_feed_cache uf
      ON uf.drop_id = d.id
     AND uf.user_id = p_user_id
     AND uf.expires_at > now()
    WHERE d.tag_done = true
      AND (p_language IS NULL OR d.language = p_language)
      AND (p_l1 IS NULL OR d.l1_topic_id = p_l1)
      AND (p_l2 IS NULL OR d.l2_topic_id = p_l2)
      AND (
        p_cursor IS NULL
        OR (
          COALESCE(uf.final_score, d.score::numeric), 
          COALESCE(d.published_at, '1970-01-01'::timestamptz), 
          d.id
        ) < (
          c_score, 
          COALESCE(c_published, '1970-01-01'::timestamptz), 
          c_id
        )
      )
  )
  SELECT 
    base.id, base.title, base.url, base.source_id, base.image_url, base.summary,
    base.published_at, base.language, base.tags, base.l1_topic_id, base.l2_topic_id,
    base.final_score, base.reason_for_ranking,
    base.youtube_video_id, base.youtube_channel_id, base.youtube_thumbnail_url,
    base.type
  FROM base
  ORDER BY base.final_score DESC, COALESCE(base.published_at, '1970-01-01'::timestamptz) DESC, base.id DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.feed_get_page_drops TO authenticated;