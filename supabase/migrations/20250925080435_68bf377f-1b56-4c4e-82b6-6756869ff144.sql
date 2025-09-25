-- Fix SQL ambiguous l1_topic_id error in database functions
-- The error occurs when column references are ambiguous in SELECT statements with JOINs

-- Drop and recreate the apply_topics_from_tags function with proper column qualifiers
DROP FUNCTION IF EXISTS public.apply_topics_from_tags(bigint) CASCADE;

CREATE OR REPLACE FUNCTION public.apply_topics_from_tags(p_drop_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  drop_tags text[];
  l1_topic_id_val bigint;
  l2_topic_id_val bigint;
  l3_tags text[] := '{}';
  tag_item text;
BEGIN
  -- Get current tags and topic IDs from the drop with EXPLICIT table aliases
  SELECT d.tags, d.l1_topic_id, d.l2_topic_id 
  INTO drop_tags, l1_topic_id_val, l2_topic_id_val
  FROM public.drops d WHERE d.id = p_drop_id;
  
  IF drop_tags IS NULL OR array_length(drop_tags, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Process tags to separate L1, L2, L3
  FOREACH tag_item IN ARRAY drop_tags
  LOOP
    -- Check if it's L1 topic
    IF EXISTS (SELECT 1 FROM public.topics t WHERE t.slug = tag_item AND t.level = 1) THEN
      SELECT t.id INTO l1_topic_id_val FROM public.topics t WHERE t.slug = tag_item AND t.level = 1 LIMIT 1;
    -- Check if it's L2 topic  
    ELSIF EXISTS (SELECT 1 FROM public.topics t WHERE t.slug = tag_item AND t.level = 2) THEN
      SELECT t.id INTO l2_topic_id_val FROM public.topics t WHERE t.slug = tag_item AND t.level = 2 LIMIT 1;
    -- Check if it's L3 topic
    ELSIF EXISTS (SELECT 1 FROM public.topics t WHERE t.slug = tag_item AND t.level = 3) THEN
      -- Add to L3 tags (max 3)
      IF array_length(l3_tags, 1) < 3 OR l3_tags = '{}' THEN
        l3_tags := l3_tags || tag_item;
      END IF;
    END IF;
  END LOOP;
  
  -- Update the drop with separated topics using EXPLICIT column names
  UPDATE public.drops d
  SET 
    l1_topic_id = l1_topic_id_val,
    l2_topic_id = l2_topic_id_val,
    tags = l3_tags
  WHERE d.id = p_drop_id;
  
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
$function$;

-- Also fix the set_drop_tags function to avoid ambiguous column references
DROP FUNCTION IF EXISTS public.set_drop_tags(bigint, text[], boolean) CASCADE;

CREATE OR REPLACE FUNCTION public.set_drop_tags(p_id bigint, p_tags text[], p_tag_done boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    IF EXISTS (SELECT 1 FROM public.topics t WHERE t.slug = tag_item AND t.level = 1) THEN
      SELECT t.id INTO l1_topic_id_val FROM public.topics t WHERE t.slug = tag_item AND t.level = 1 LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM public.topics t WHERE t.slug = tag_item AND t.level = 2) THEN
      SELECT t.id INTO l2_topic_id_val FROM public.topics t WHERE t.slug = tag_item AND t.level = 2 LIMIT 1;
    ELSIF EXISTS (SELECT 1 FROM public.topics t WHERE t.slug = tag_item AND t.level = 3) THEN
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
  
  -- Update the drop with EXPLICIT table alias
  UPDATE public.drops d
  SET 
    l1_topic_id = COALESCE(l1_topic_id_val, d.l1_topic_id),
    l2_topic_id = COALESCE(l2_topic_id_val, d.l2_topic_id),
    tags = l3_tags,
    tag_done = p_tag_done
  WHERE d.id = p_id;
  
  -- Manually update content_topics junction table
  DELETE FROM public.content_topics WHERE content_id = p_id;
  
  -- Insert L1 topic
  IF l1_topic_id_val IS NOT NULL THEN
    INSERT INTO public.content_topics (content_id, topic_id)
    VALUES (p_id, l1_topic_id_val)
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END IF;
  
  -- Insert L2 topic  
  IF l2_topic_id_val IS NOT NULL THEN
    INSERT INTO public.content_topics (content_id, topic_id)
    VALUES (p_id, l2_topic_id_val)
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END IF;
  
  -- Insert L3 topics
  FOR i IN 1..array_length(l3_tags, 1)
  LOOP
    INSERT INTO public.content_topics (content_id, topic_id)
    SELECT p_id, t.id
    FROM public.topics t
    WHERE t.slug = l3_tags[i] AND t.level = 3
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END LOOP;
END;
$function$;