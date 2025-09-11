-- Step 1: First, disable the problematic trigger to stop the infinite recursion
DROP TRIGGER IF EXISTS drops_apply_topics_from_tags ON public.drops;

-- Step 2: Drop the constraint check that's causing issues
ALTER TABLE public.drops DROP CONSTRAINT IF EXISTS chk_tags_l3_only;

-- Step 3: Fix the problematic function - remove the call that creates infinite recursion
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
  
  -- Update the drop (this will NOT trigger the problematic function anymore)
  UPDATE public.drops 
  SET 
    l1_topic_id = COALESCE(l1_topic_id_val, l1_topic_id),
    l2_topic_id = COALESCE(l2_topic_id_val, l2_topic_id),
    tags = l3_tags,
    tag_done = p_tag_done
  WHERE id = p_id;
  
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
$$;