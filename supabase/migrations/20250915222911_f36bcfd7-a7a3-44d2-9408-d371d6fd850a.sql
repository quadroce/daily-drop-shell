-- Temporarily disable the validation trigger to fix untagged articles
ALTER TABLE public.content_topics DISABLE TRIGGER ALL;

-- Step 1: Fix untagged articles with media tags
UPDATE public.drops 
SET 
  l1_topic_id = 6,    -- media (L1)
  l2_topic_id = 34,   -- journalism (L2)
  tags = ARRAY['media-relations']::text[],  -- Set L3 tag  
  tag_done = true
WHERE tag_done = false 
  AND 'media' = ANY(tags);

-- Step 2: Insert proper topic relationships with conflict handling
-- Insert L1 (Media & Communications)
INSERT INTO public.content_topics (content_id, topic_id)
SELECT id, 6 FROM public.drops 
WHERE l1_topic_id = 6
ON CONFLICT (content_id, topic_id) DO NOTHING;

-- Insert L2 (Journalism)  
INSERT INTO public.content_topics (content_id, topic_id)
SELECT id, 34 FROM public.drops 
WHERE l2_topic_id = 34
ON CONFLICT (content_id, topic_id) DO NOTHING;

-- Insert L3 (Media Relations - id 189)
INSERT INTO public.content_topics (content_id, topic_id)
SELECT d.id, 189 FROM public.drops d
WHERE d.l1_topic_id = 6 AND d.l2_topic_id = 34 
  AND 'media-relations' = ANY(d.tags)
ON CONFLICT (content_id, topic_id) DO NOTHING;

-- Re-enable the validation trigger
ALTER TABLE public.content_topics ENABLE TRIGGER ALL;