-- First, let's fix untagged articles by properly setting their topic hierarchy
-- Step 1: Update drops with 'media' tags to have proper L1 and L2 topics
UPDATE public.drops 
SET 
  l1_topic_id = 6,    -- media (L1)
  l2_topic_id = 34,   -- communications (L2, child of media)
  tag_done = true
WHERE tag_done = false 
  AND 'media' = ANY(tags)
  AND l1_topic_id IS NULL;

-- Step 2: Update content_topics junction table 
-- Remove any existing relationships for these articles first
DELETE FROM public.content_topics 
WHERE content_id IN (
  SELECT id FROM public.drops 
  WHERE l1_topic_id = 6 AND l2_topic_id = 34 
  AND tag_done = true
);

-- Insert L1 relationships
INSERT INTO public.content_topics (content_id, topic_id)
SELECT id, 6 FROM public.drops 
WHERE l1_topic_id = 6 AND tag_done = true
ON CONFLICT (content_id, topic_id) DO NOTHING;

-- Insert L2 relationships  
INSERT INTO public.content_topics (content_id, topic_id)
SELECT id, 34 FROM public.drops 
WHERE l2_topic_id = 34 AND tag_done = true
ON CONFLICT (content_id, topic_id) DO NOTHING;