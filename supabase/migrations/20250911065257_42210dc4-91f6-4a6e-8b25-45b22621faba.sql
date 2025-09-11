-- Step 1: Fix the existing apply_topics_from_tags function that has ambiguous column references
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
  -- Get current tags and topic IDs from the drop
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
  
  -- Update the drop with separated topics (using qualified column names)
  UPDATE public.drops 
  SET 
    l1_topic_id = l1_topic_id_val,
    l2_topic_id = l2_topic_id_val,
    tags = l3_tags
  WHERE drops.id = p_drop_id;
  
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

-- Step 2: Update set_drop_tags function to enforce new rules
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
  current_l1 bigint;
  current_l2 bigint;
BEGIN
  -- Get current L1 and L2 topic IDs
  SELECT d.l1_topic_id, d.l2_topic_id 
  INTO current_l1, current_l2
  FROM public.drops d WHERE d.id = p_id;
  
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
  
  -- Use current values if new ones not found
  l1_topic_id_val := COALESCE(l1_topic_id_val, current_l1);
  l2_topic_id_val := COALESCE(l2_topic_id_val, current_l2);
  
  -- Validate constraints
  IF l1_topic_id_val IS NULL OR l2_topic_id_val IS NULL OR l3_count = 0 THEN
    p_tag_done := false;
  END IF;
  
  -- Update the drop
  UPDATE public.drops 
  SET 
    l1_topic_id = l1_topic_id_val,
    l2_topic_id = l2_topic_id_val,
    tags = l3_tags,
    tag_done = p_tag_done
  WHERE drops.id = p_id;
  
  -- Apply topics from tags to maintain content_topics sync
  PERFORM public.apply_topics_from_tags(p_id);
END;
$$;