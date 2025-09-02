-- Replace get_candidate_drops with new ranking-aware function
DROP FUNCTION IF EXISTS public.get_candidate_drops(integer);

CREATE OR REPLACE FUNCTION public.get_ranked_drops(limit_n integer DEFAULT 10)
RETURNS TABLE(
    id bigint,
    title text,
    url text,
    image_url text,
    summary text,
    type drop_type,
    tags text[],
    source_id bigint,
    published_at timestamp with time zone,
    final_score decimal(5,3),
    reason_for_ranking text
) AS $$
DECLARE
    _uid uuid := auth.uid();
    drop_record RECORD;
    base_score decimal(5,3);
    personal_score decimal(5,3);
    recency_score decimal(3,2);
    trust_score decimal(3,2);
    popularity_score decimal(3,2);
    topic_match decimal(3,2);
    feedback_score decimal(3,2);
    final_drop_score decimal(5,3);
    reason_parts text[] := '{}';
BEGIN
    /* Purpose: Advanced content ranking with personalization */
    IF _uid IS NULL THEN 
        RAISE EXCEPTION 'Auth required: no user in JWT'; 
    END IF;
    
    -- Return ranked drops using the new algorithm
    FOR drop_record IN 
        SELECT d.id, d.title, d.url, d.image_url, d.summary, d.type, d.tags,
               d.source_id, d.published_at, d.created_at, d.authority_score, 
               d.quality_score, d.popularity_score
        FROM public.drops d
        WHERE d.tag_done = true
        AND d.published_at >= (now() - interval '7 days') -- Only last 7 days
        ORDER BY COALESCE(d.published_at, d.created_at) DESC
        LIMIT 100 -- Get candidates for ranking
    LOOP
        -- Calculate base score components
        recency_score := calculate_recency_score(drop_record.published_at);
        trust_score := (COALESCE(drop_record.authority_score, 0.5) + COALESCE(drop_record.quality_score, 0.5)) / 2;
        popularity_score := calculate_popularity_score(COALESCE(drop_record.popularity_score, 0));
        
        -- Base Score: 30% recency + 25% trust + 15% popularity
        base_score := 0.3 * recency_score + 0.25 * trust_score + 0.15 * popularity_score;
        
        -- Calculate personalization components
        reason_parts := '{}';
        
        -- Topic matching (check if user's topics match drop tags)
        topic_match := 0;
        IF EXISTS (
            SELECT 1 FROM public.preferences p
            JOIN public.topics t ON t.id = ANY(p.selected_topic_ids)
            WHERE p.user_id = _uid
            AND t.slug = ANY(drop_record.tags)
        ) THEN
            topic_match := 1;
            reason_parts := reason_parts || 'Matches interests';
        END IF;
        
        -- User feedback score
        feedback_score := get_user_feedback_score(_uid, drop_record.id, drop_record.source_id, drop_record.tags);
        
        -- Personal Score: 20% topic match + 25% feedback (vector similarity placeholder: 0)
        personal_score := 0.2 * topic_match + 0.25 * feedback_score;
        
        -- Final Score: 40% base + 60% personal
        final_drop_score := 0.4 * base_score + 0.6 * personal_score;
        
        -- Build reason for ranking
        IF recency_score > 0.8 THEN
            reason_parts := array_prepend('Fresh content', reason_parts);
        END IF;
        
        IF trust_score > 0.7 THEN
            reason_parts := reason_parts || 'High quality';
        END IF;
        
        IF feedback_score > 0.1 THEN
            reason_parts := reason_parts || 'Similar content liked';
        END IF;
        
        -- Return the drop with its score
        RETURN QUERY SELECT 
            drop_record.id,
            drop_record.title,
            drop_record.url,
            drop_record.image_url,
            drop_record.summary,
            drop_record.type,
            drop_record.tags,
            drop_record.source_id,
            drop_record.published_at,
            final_drop_score,
            COALESCE(array_to_string(reason_parts[1:2], ' • '), 'Relevant content')::text;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Create a simpler function for backward compatibility
CREATE OR REPLACE FUNCTION public.get_candidate_drops(limit_n integer DEFAULT 10)
RETURNS SETOF drops AS $$
BEGIN
    /* Backward compatibility - returns drops for existing code */
    RETURN QUERY
    SELECT d.*
    FROM public.drops d
    WHERE d.tag_done = true
    AND (
        -- Match user topics
        EXISTS (
            SELECT 1 FROM public.preferences p
            JOIN public.topics t ON t.id = ANY(p.selected_topic_ids)
            WHERE p.user_id = auth.uid()
            AND t.slug = ANY(d.tags)
        )
        OR
        -- If no preferences, show all
        NOT EXISTS (
            SELECT 1 FROM public.preferences p
            WHERE p.user_id = auth.uid()
            AND array_length(p.selected_topic_ids, 1) > 0
        )
    )
    ORDER BY COALESCE(d.published_at, d.created_at) DESC
    LIMIT limit_n;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;