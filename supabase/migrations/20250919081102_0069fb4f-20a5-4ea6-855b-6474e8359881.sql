-- Fix critical database error: ambiguous column reference in apply_topics_from_tags function
DROP FUNCTION IF EXISTS public.apply_topics_from_tags(bigint);

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
  -- Get current tags and topic IDs from the drop with qualified column names
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
  
  -- Update the drop with separated topics using fully qualified column names
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
$function$;

-- Add table to track source health and errors
CREATE TABLE IF NOT EXISTS public.source_health (
  source_id bigint PRIMARY KEY,
  consecutive_errors integer DEFAULT 0,
  last_error_at timestamp with time zone,
  error_type text,
  is_paused boolean DEFAULT false,
  paused_until timestamp with time zone,
  last_success_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on source_health
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;

-- Policy for admin access to source health
CREATE POLICY "source_health_admin_access" ON public.source_health
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_source_health_paused ON public.source_health (is_paused, paused_until);
CREATE INDEX IF NOT EXISTS idx_source_health_errors ON public.source_health (consecutive_errors, last_error_at);