-- Process more untagged media articles and clear queue issues
DO $$
DECLARE
    drop_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Fix more untagged media articles
    FOR drop_record IN 
        SELECT id FROM drops 
        WHERE tag_done = false 
        AND 'media' = ANY(tags) 
        LIMIT 20
    LOOP
        PERFORM set_drop_tags(
            drop_record.id, 
            ARRAY['media', 'journalism', 'media-relations']::text[], 
            true
        );
        processed_count := processed_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Fixed % more articles', processed_count;

    -- Clear stuck queue items (older than 4 hours)
    UPDATE ingestion_queue 
    SET status = 'pending', tries = 0, error = null 
    WHERE status = 'processing' 
    AND created_at < (now() - interval '4 hours');
    
    RAISE NOTICE 'Cleared stuck queue items';
END $$;