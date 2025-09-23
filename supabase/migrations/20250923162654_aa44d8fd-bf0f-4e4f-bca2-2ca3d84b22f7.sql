-- Create RPC function to get paginated drops from cache or live ranking
CREATE OR REPLACE FUNCTION public.feed_get_page_drops(
    p_user_id uuid,
    p_limit integer DEFAULT 30,
    p_cursor text DEFAULT NULL,
    p_language text DEFAULT NULL,
    p_l1 integer DEFAULT NULL,
    p_l2 integer DEFAULT NULL
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
    type drop_type,
    youtube_video_id text,
    youtube_channel_id text,
    youtube_thumbnail_url text,
    source_name text,
    final_score numeric,
    reason_for_ranking text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cache_count integer;
    start_position integer DEFAULT 1;
BEGIN
    -- Check if user has valid cache
    SELECT COUNT(*) INTO cache_count
    FROM user_feed_cache ufc
    WHERE ufc.user_id = p_user_id 
    AND ufc.expires_at > now();
    
    -- If we have cached results, use them
    IF cache_count > 0 THEN
        -- Parse cursor for position-based pagination
        IF p_cursor IS NOT NULL THEN
            BEGIN
                start_position := (p_cursor::jsonb->>'position')::integer;
            EXCEPTION WHEN OTHERS THEN
                start_position := 1;
            END;
        END IF;
        
        -- Return cached results with pagination
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
            d.type,
            d.youtube_video_id,
            d.youtube_channel_id,
            d.youtube_thumbnail_url,
            COALESCE(s.name, 'Unknown') as source_name,
            ufc.final_score,
            ufc.reason_for_ranking
        FROM user_feed_cache ufc
        JOIN drops d ON ufc.drop_id = d.id
        LEFT JOIN sources s ON d.source_id = s.id
        WHERE ufc.user_id = p_user_id
        AND ufc.position >= start_position
        AND ufc.expires_at > now()
        ORDER BY ufc.position
        LIMIT p_limit;
        
    ELSE
        -- No cache available, return empty set (hook will fallback to direct query)
        RETURN;
    END IF;
END;
$$;