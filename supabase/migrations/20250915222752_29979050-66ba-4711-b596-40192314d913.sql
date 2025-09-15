-- Fix untagged articles with proper L1, L2, and L3 topic hierarchy
-- Step 1: Update drops with 'media' tags to have proper topic hierarchy
UPDATE public.drops 
SET 
  l1_topic_id = 6,    -- media (L1)
  l2_topic_id = 34,   -- journalism (L2)
  tags = ARRAY['media-relations']::text[],  -- Set L3 tag  
  tag_done = true
WHERE tag_done = false 
  AND 'media' = ANY(tags)
  AND l1_topic_id IS NULL;

-- Step 2: Clear existing content_topics relationships for these articles
DELETE FROM public.content_topics 
WHERE content_id IN (
  SELECT id FROM public.drops 
  WHERE l1_topic_id = 6 AND l2_topic_id = 34 AND tag_done = true
);

-- Step 3: Insert proper topic relationships
-- Insert L1 (Media & Communications)
INSERT INTO public.content_topics (content_id, topic_id)
SELECT id, 6 FROM public.drops 
WHERE l1_topic_id = 6 AND tag_done = true;

-- Insert L2 (Journalism)  
INSERT INTO public.content_topics (content_id, topic_id)
SELECT id, 34 FROM public.drops 
WHERE l2_topic_id = 34 AND tag_done = true;

-- Insert L3 (Media Relations) - topic_id 189 based on previous query
INSERT INTO public.content_topics (content_id, topic_id)
SELECT d.id, 189 FROM public.drops d
WHERE d.l1_topic_id = 6 AND d.l2_topic_id = 34 
  AND 'media-relations' = ANY(d.tags) AND d.tag_done = true;