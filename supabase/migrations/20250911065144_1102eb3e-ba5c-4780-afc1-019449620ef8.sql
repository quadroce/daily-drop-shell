-- Step 1: Add NOT NULL constraints to l1_topic_id and l2_topic_id (with default values first)
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

-- Step 2: Add foreign key constraints
ALTER TABLE public.drops 
ADD CONSTRAINT fk_drops_l1_topic FOREIGN KEY (l1_topic_id) REFERENCES public.topics(id),
ADD CONSTRAINT fk_drops_l2_topic FOREIGN KEY (l2_topic_id) REFERENCES public.topics(id);

-- Step 3: Create function to migrate legacy tags to new structure
CREATE OR REPLACE FUNCTION public.migrate_legacy_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
END;
$$;

-- Step 4: Run the migration
SELECT public.migrate_legacy_tags();

-- Step 5: Create updated trigger function
CREATE OR REPLACE FUNCTION public.apply_topics_from_tags(p_drop_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  drop_tags text[];
  l1_topic_id_val bigint;
  l2_topic_id_val bigint;
  l3_tags text[] := '{}';
  tag_item text;
BEGIN
  -- Get current tags
  SELECT tags INTO drop_tags FROM public.drops WHERE id = p_drop_id;
  
  IF drop_tags IS NULL OR array_length(drop_tags, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Get current L1 and L2 values
  SELECT d.l1_topic_id, d.l2_topic_id 
  INTO l1_topic_id_val, l2_topic_id_val
  FROM public.drops d WHERE d.id = p_drop_id;
  
  -- Process tags to separate L1, L2, L3
  FOREACH tag_item IN ARRAY drop_tags
  LOOP
    -- Check if it's L1 topic
    IF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 1) THEN
      SELECT t.id INTO l1_topic_id_val FROM public.topics t WHERE t.slug = tag_item AND t.level = 1 LIMIT 1;
    -- Check if it's L2 topic  
    ELSIF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 2) THEN
      SELECT t.id INTO l2_topic_id_val FROM public.topics t WHERE t.slug = tag_item AND t.level = 2 LIMIT 1;
    -- Check if it's L3 topic
    ELSIF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 3) THEN
      -- Add to L3 tags (max 3)
      IF array_length(l3_tags, 1) < 3 OR l3_tags = '{}' THEN
        l3_tags := l3_tags || tag_item;
      END IF;
    END IF;
  END LOOP;
  
  -- Update the drop with separated topics
  UPDATE public.drops 
  SET 
    l1_topic_id = COALESCE(l1_topic_id_val, l1_topic_id),
    l2_topic_id = COALESCE(l2_topic_id_val, l2_topic_id),
    tags = l3_tags
  WHERE id = p_drop_id;
  
  -- Update content_topics junction table
  DELETE FROM public.content_topics WHERE content_id = p_drop_id;
  
  -- Insert L1 topic
  IF l1_topic_id_val IS NOT NULL THEN
    INSERT INTO public.content_topics (content_id, topic_id)
    VALUES (p_drop_id, l1_topic_id_val)
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END IF;
  
  -- Insert L2 topic  
  IF l2_topic_id_val IS NOT NULL THEN
    INSERT INTO public.content_topics (content_id, topic_id)
    VALUES (p_drop_id, l2_topic_id_val)
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END IF;
  
  -- Insert L3 topics
  FOR i IN 1..array_length(l3_tags, 1)
  LOOP
    INSERT INTO public.content_topics (content_id, topic_id)
    SELECT p_drop_id, t.id
    FROM public.topics t
    WHERE t.slug = l3_tags[i] AND t.level = 3
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Step 6: Update set_drop_tags function to enforce new rules
CREATE OR REPLACE FUNCTION public.set_drop_tags(p_id bigint, p_tags text[], p_tag_done boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  l1_topic_id_val bigint;
  l2_topic_id_val bigint;
  l3_tags text[] := '{}';
  tag_item text;
  l3_count int := 0;
BEGIN
  -- Separate tags by level
  FOREACH tag_item IN ARRAY p_tags
  LOOP
    IF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 1) THEN
      SELECT id INTO l1_topic_id_val FROM public.topics WHERE slug = tag_item AND level = 1 LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 2) THEN
      SELECT id INTO l2_topic_id_val FROM public.topics WHERE slug = tag_item AND level = 2 LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM public.topics WHERE slug = tag_item AND level = 3) THEN
      IF l3_count < 3 THEN
        l3_tags := l3_tags || tag_item;
        l3_count := l3_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  -- Validate constraints
  IF l1_topic_id_val IS NULL OR l2_topic_id_val IS NULL OR l3_count = 0 THEN
    p_tag_done := false;
  END IF;
  
  -- Update the drop
  UPDATE public.drops 
  SET 
    l1_topic_id = COALESCE(l1_topic_id_val, l1_topic_id),
    l2_topic_id = COALESCE(l2_topic_id_val, l2_topic_id),
    tags = l3_tags,
    tag_done = p_tag_done
  WHERE id = p_id;
  
  -- Apply topics from tags to maintain content_topics sync
  PERFORM public.apply_topics_from_tags(p_id);
END;
$$;

-- Step 7: Add check constraints for tag validation
ALTER TABLE public.drops 
ADD CONSTRAINT chk_tags_l3_only CHECK (
  array_length(tags, 1) <= 3 AND
  array_length(tags, 1) >= 1
);

-- Step 8: Add indices for performance
CREATE INDEX IF NOT EXISTS idx_drops_l1_topic ON public.drops(l1_topic_id);
CREATE INDEX IF NOT EXISTS idx_drops_l2_topic ON public.drops(l2_topic_id);
CREATE INDEX IF NOT EXISTS idx_drops_tags_gin ON public.drops USING GIN(tags);

-- Step 9: Drop the language column (keeping lang_code)
ALTER TABLE public.drops DROP COLUMN IF EXISTS language;

-- Step 10: Clean up the migration function
DROP FUNCTION IF EXISTS public.migrate_legacy_tags();