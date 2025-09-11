-- Step 1: Drop existing constraints if they exist to avoid conflicts
ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS fk_drops_l1_topic;
ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS fk_drops_l2_topic;
ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS chk_tags_l3_only;

-- Step 2: Add NOT NULL constraints to l1_topic_id and l2_topic_id (with default values first)
-- First set default values for existing NULL records
UPDATE public.drops 
SET l1_topic_id = (SELECT id FROM public.topics WHERE level = 1 ORDER BY id LIMIT 1)
WHERE l1_topic_id IS NULL;

UPDATE public.drops 
SET l2_topic_id = (SELECT id FROM public.topics WHERE level = 2 ORDER BY id LIMIT 1)
WHERE l2_topic_id IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE public.drops 
ALTER COLUMN l1_topic_id SET NOT NULL,
ALTER COLUMN l2_topic_id SET NOT NULL;

-- Step 3: Add foreign key constraints
ALTER TABLE public.drops 
ADD CONSTRAINT fk_drops_l1_topic FOREIGN KEY (l1_topic_id) REFERENCES public.topics(id),
ADD CONSTRAINT fk_drops_l2_topic FOREIGN KEY (l2_topic_id) REFERENCES public.topics(id);

-- Step 4: Migrate legacy tags to new structure
DO $$
DECLARE
    drop_record RECORD;
    l1_topic_id_val bigint;
    l2_topic_id_val bigint;
    l3_tags text[] := '{}';
    tag_item text;
BEGIN
    FOR drop_record IN 
        SELECT id, tags, l1_topic_id, l2_topic_id
        FROM public.drops 
        WHERE array_length(tags, 1) > 0
    LOOP
        l1_topic_id_val := drop_record.l1_topic_id;
        l2_topic_id_val := drop_record.l2_topic_id;
        l3_tags := '{}';
        
        -- Process each tag
        FOREACH tag_item IN ARRAY drop_record.tags
        LOOP
            -- Check if it's L1 topic
            IF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 1) THEN
                SELECT id INTO l1_topic_id_val FROM public.topics WHERE slug = tag_item AND level = 1 LIMIT 1;
            -- Check if it's L2 topic
            ELSIF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 2) THEN
                SELECT id INTO l2_topic_id_val FROM public.topics WHERE slug = tag_item AND level = 2 LIMIT 1;
            -- Check if it's L3 topic
            ELSIF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 3) THEN
                -- Add to L3 tags (max 3)
                IF array_length(l3_tags, 1) < 3 OR l3_tags = '{}' THEN
                    l3_tags := l3_tags || tag_item;
                END IF;
            END IF;
        END LOOP;
        
        -- Update the drop with migrated data
        UPDATE public.drops 
        SET 
            l1_topic_id = l1_topic_id_val,
            l2_topic_id = l2_topic_id_val,
            tags = l3_tags,
            tag_done = CASE 
                WHEN l1_topic_id_val IS NOT NULL 
                     AND l2_topic_id_val IS NOT NULL 
                     AND array_length(l3_tags, 1) >= 1 
                     AND array_length(l3_tags, 1) <= 3
                THEN true 
                ELSE false 
            END
        WHERE id = drop_record.id;
    END LOOP;
END $$;

-- Step 5: Drop the language column (keeping lang_code)
ALTER TABLE public.drops DROP COLUMN IF EXISTS language;

-- Step 6: Add indices for performance
CREATE INDEX IF NOT EXISTS idx_drops_l1_topic ON public.drops(l1_topic_id);
CREATE INDEX IF NOT EXISTS idx_drops_l2_topic ON public.drops(l2_topic_id);
CREATE INDEX IF NOT EXISTS idx_drops_tags_gin ON public.drops USING GIN(tags);

-- Step 7: Add constraint for L3 tags validation (only after migration is complete)
ALTER TABLE public.drops 
ADD CONSTRAINT chk_tags_l3_max_3 CHECK (array_length(tags, 1) <= 3);

-- Step 8: Add constraint for minimum L3 tags (we allow 0 for now during tagging process)
ALTER TABLE public.drops 
ADD CONSTRAINT chk_tags_l3_min_0 CHECK (array_length(tags, 1) >= 0 OR tags = '{}');