-- Use the existing set_drop_tags function to properly handle tagging validation
-- This function already handles the content_topics relationships correctly

-- Process untagged media articles one by one using the safe function
DO $$
DECLARE
    drop_record RECORD;
BEGIN
    FOR drop_record IN 
        SELECT id FROM drops 
        WHERE tag_done = false 
        AND 'media' = ANY(tags) 
        LIMIT 10
    LOOP
        -- Use the existing function that handles validation properly
        PERFORM set_drop_tags(
            drop_record.id, 
            ARRAY['media', 'journalism', 'media-relations']::text[], 
            true
        );
        
        RAISE NOTICE 'Fixed article %', drop_record.id;
    END LOOP;
END $$;