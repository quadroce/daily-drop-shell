-- Fix get_candidate_drops function to filter by topics AND languages
CREATE OR REPLACE FUNCTION public.get_candidate_drops(limit_n integer DEFAULT 10)
RETURNS SETOF drops
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    /* Purpose: Retrieve drops matching user's topic AND language preferences, ordered by recency */
    SELECT d.*
    FROM public.drops d
    WHERE d.tag_done = true
    AND (
        -- Check if drop's tags match user's selected topics
        EXISTS (
            SELECT 1 
            FROM public.preferences p
            JOIN public.topics t ON t.id = ANY(p.selected_topic_ids)
            WHERE p.user_id = auth.uid()
            AND t.slug = ANY(d.tags)
        )
        OR 
        -- If user has no topic preferences, show all
        NOT EXISTS (
            SELECT 1 
            FROM public.preferences p
            WHERE p.user_id = auth.uid()
            AND array_length(p.selected_topic_ids, 1) > 0
        )
    )
    AND (
        -- Check language preferences (keep existing logic)
        COALESCE(d.lang_id, 0) = ANY (
            SELECT unnest(COALESCE(p.selected_language_ids, '{}'::bigint[]))
            FROM public.preferences p
            WHERE p.user_id = auth.uid()
        )
        OR
        -- If no language preferences, show all
        NOT EXISTS (
            SELECT 1 
            FROM public.preferences p
            WHERE p.user_id = auth.uid()
            AND array_length(p.selected_language_ids, 1) > 0
        )
    )
    ORDER BY COALESCE(d.published_at, d.created_at) DESC
    LIMIT limit_n;
$function$