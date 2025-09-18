-- Create RPC function to consolidate user preferences
CREATE OR REPLACE FUNCTION public.upsert_preferences(_topics bigint[], _langs bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Upsert preferences table (main source of truth)
    INSERT INTO public.preferences (user_id, selected_topic_ids, selected_language_ids, updated_at)
    VALUES (auth.uid(), _topics, _langs, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        selected_topic_ids = _topics,
        selected_language_ids = _langs,
        updated_at = now();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_preferences(bigint[], bigint[]) TO authenticated;