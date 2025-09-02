-- Fix the language filtering logic in get_candidate_drops function
CREATE OR REPLACE FUNCTION public.get_candidate_drops(limit_n integer DEFAULT 10)
 RETURNS SETOF drops
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    /* Purpose: Retrieve drops matching user's topic preferences with related topic expansion */
    SELECT d.*
    FROM public.drops d
    WHERE d.tag_done = true
    AND (
        -- Direct topic match
        EXISTS (
            SELECT 1 
            FROM public.preferences p
            JOIN public.topics t ON t.id = ANY(p.selected_topic_ids)
            WHERE p.user_id = auth.uid()
            AND t.slug = ANY(d.tags)
        )
        OR
        -- Expanded topic matching for related interests
        EXISTS (
            SELECT 1 
            FROM public.preferences p
            JOIN public.topics t ON t.id = ANY(p.selected_topic_ids)
            WHERE p.user_id = auth.uid()
            AND (
                -- AI & ML expansion
                (t.slug = 'ai' AND ('datasci' = ANY(d.tags) OR 'dev' = ANY(d.tags) OR 'ml' = ANY(d.tags)))
                OR
                -- HealthTech expansion  
                (t.slug = 'healthtech' AND ('medicine' = ANY(d.tags) OR 'biotech' = ANY(d.tags) OR 'medtech' = ANY(d.tags)))
                OR
                -- Dev expansion
                (t.slug = 'dev' AND ('ai' = ANY(d.tags) OR 'cloud' = ANY(d.tags) OR 'opensource' = ANY(d.tags)))
                OR
                -- Data Science expansion
                (t.slug = 'datasci' AND ('ai' = ANY(d.tags) OR 'analytics' = ANY(d.tags) OR 'bigdata' = ANY(d.tags)))
            )
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
        -- Fixed language filtering - match both lang_id and lang_code
        (
            -- Match by lang_id if available
            COALESCE(d.lang_id, 0) = ANY (
                SELECT unnest(COALESCE(p.selected_language_ids, '{}'::bigint[]))
                FROM public.preferences p
                WHERE p.user_id = auth.uid()
            )
        )
        OR
        (
            -- Match by lang_code if lang_id is null but lang_code matches selected language
            d.lang_id IS NULL AND d.lang_code = ANY (
                SELECT l.code
                FROM public.preferences p
                JOIN public.languages l ON l.id = ANY(p.selected_language_ids)
                WHERE p.user_id = auth.uid()
            )
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
$function$;