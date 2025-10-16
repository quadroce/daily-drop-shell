-- Create helper function for topic selection (fixed: use created_at instead of updated_at)
CREATE OR REPLACE FUNCTION public.get_top_topics_by_date(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit integer DEFAULT 2
) RETURNS TABLE (
  topic_id bigint,
  topic_slug text,
  topic_label text,
  article_count bigint,
  latest_published timestamptz
) LANGUAGE sql STABLE AS $$
  SELECT 
    t.id as topic_id,
    t.slug as topic_slug,
    t.label as topic_label,
    COUNT(DISTINCT d.id) as article_count,
    MAX(d.published_at) as latest_published
  FROM public.topics t
  INNER JOIN public.content_topics ct ON ct.topic_id = t.id
  INNER JOIN public.drops d ON d.id = ct.content_id
  WHERE t.is_active = true
    AND d.tag_done = true
    AND d.published_at >= p_start_date
    AND d.published_at < p_end_date
  GROUP BY t.id, t.slug, t.label
  HAVING COUNT(DISTINCT d.id) > 0
  ORDER BY COUNT(DISTINCT d.id) DESC, MAX(d.published_at) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_top_topics_by_date IS 'Selects top topics by article count within a date range, with tie-break by latest published date';