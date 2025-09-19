-- Fix the RPC function structure to match exact database schema
DROP FUNCTION IF EXISTS public.feed_get_page_drops(uuid,int,text,text,bigint,bigint);

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
BEGIN
  -- Decode cursor if provided: base64("final_score:published_iso:id")
  IF p_cursor IS NOT NULL THEN
    WITH decoded AS (
      SELECT
        SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 1)::numeric AS s,
        SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 2)::timestamptz AS t,
        SPLIT_PART(convert_from(decode(p_cursor,'base64'),'utf8'), ':', 3)::bigint AS i
    )
    SELECT s, t, i INTO c_score, c_published, c_id FROM decoded;
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
        OR (COALESCE(uf.final_score, d.score::numeric), d.published_at, d.id) < (c_score, c_published, c_id)
      )
  )
  SELECT *
  FROM base
  ORDER BY final_score DESC, published_at DESC, id DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

-- Grant permissions with correct parameter types
REVOKE ALL ON FUNCTION public.feed_get_page_drops(uuid,int,text,text,integer,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.feed_get_page_drops(uuid,int,text,text,integer,integer) TO authenticated;