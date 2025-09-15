-- Fix untagged articles with 'media' tags by setting proper topic classification
UPDATE public.drops 
SET 
  l1_topic_id = 6,    -- media (L1)
  l2_topic_id = 34,   -- media child topic (L2)  
  tag_done = true
WHERE tag_done = false 
  AND 'media' = ANY(tags)
  AND l1_topic_id IS NULL;

-- Insert corresponding content_topics relationships
INSERT INTO public.content_topics (content_id, topic_id)
SELECT d.id, 6 FROM public.drops d 
WHERE d.l1_topic_id = 6 AND NOT EXISTS (
  SELECT 1 FROM public.content_topics ct WHERE ct.content_id = d.id AND ct.topic_id = 6
);

INSERT INTO public.content_topics (content_id, topic_id)  
SELECT d.id, 34 FROM public.drops d
WHERE d.l2_topic_id = 34 AND NOT EXISTS (
  SELECT 1 FROM public.content_topics ct WHERE ct.content_id = d.id AND ct.topic_id = 34
);