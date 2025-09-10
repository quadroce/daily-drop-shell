-- Fix tagging pipeline: create compatibility view and sync functions

-- 1) Create compatibility view for content (alias of drops)
CREATE OR REPLACE VIEW public.content AS
SELECT 
  id,
  title,
  url,
  image_url,
  summary,
  type,
  tags,
  source_id,
  published_at,
  created_at,
  tag_done,
  l1_topic_id,
  l2_topic_id,
  language,
  (
    SELECT COUNT(*)
    FROM public.topics t
    WHERE t.level = 3 
    AND t.slug = ANY(drops.tags)
  ) as l3_count
FROM public.drops;

-- 2) Create function to apply topics from tags
CREATE OR REPLACE FUNCTION public.apply_topics_from_tags(p_drop_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  drop_tags text[];
  l1_topic_id bigint;
  l2_topic_id bigint;
  topic_rec record;
BEGIN
  -- Get current tags
  SELECT tags INTO drop_tags FROM public.drops WHERE id = p_drop_id;
  
  IF drop_tags IS NULL THEN
    RETURN;
  END IF;
  
  -- Find L1 topic (min id at level 1)
  SELECT t.id INTO l1_topic_id
  FROM public.topics t
  WHERE t.level = 1 
    AND t.slug = ANY(drop_tags)
  ORDER BY t.id
  LIMIT 1;
  
  -- Find L2 topic (min id at level 2)
  SELECT t.id INTO l2_topic_id
  FROM public.topics t
  WHERE t.level = 2 
    AND t.slug = ANY(drop_tags)
  ORDER BY t.id
  LIMIT 1;
  
  -- Update l1_topic_id and l2_topic_id
  UPDATE public.drops 
  SET l1_topic_id = l1_topic_id, l2_topic_id = l2_topic_id
  WHERE id = p_drop_id;
  
  -- Insert all matching topics into content_topics
  FOR topic_rec IN 
    SELECT t.id
    FROM public.topics t
    WHERE t.slug = ANY(drop_tags)
  LOOP
    INSERT INTO public.content_topics (content_id, topic_id)
    VALUES (p_drop_id, topic_rec.id)
    ON CONFLICT (content_id, topic_id) DO NOTHING;
  END LOOP;
END;
$$;

-- 3) Create trigger function
CREATE OR REPLACE FUNCTION public.trg_apply_topics_from_tags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.apply_topics_from_tags(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS drops_apply_topics_from_tags ON public.drops;
CREATE TRIGGER drops_apply_topics_from_tags
  AFTER INSERT OR UPDATE OF tags ON public.drops
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_topics_from_tags();

-- 4) Create RPC for setting drop tags
CREATE OR REPLACE FUNCTION public.set_drop_tags(
  p_id bigint, 
  p_tags text[], 
  p_tag_done boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update tags and tag_done
  UPDATE public.drops 
  SET tags = p_tags, tag_done = p_tag_done
  WHERE id = p_id;
  
  -- Apply topics from tags (trigger will handle this, but call explicitly for safety)
  PERFORM public.apply_topics_from_tags(p_id);
END;
$$;

-- 5) Backward compatibility wrapper
CREATE OR REPLACE FUNCTION public.set_article_topics(
  p_id integer, 
  p_tags text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.set_drop_tags(p_id::bigint, p_tags, true);
END;
$$;

-- 6) Diagnostic view
CREATE OR REPLACE VIEW public.tagging_status AS
SELECT 
  id,
  title,
  tag_done,
  tags,
  l1_topic_id,
  l2_topic_id,
  (
    SELECT COUNT(*)
    FROM public.topics t
    WHERE t.level = 3 
    AND t.slug = ANY(drops.tags)
  ) as l3_count,
  (
    SELECT COUNT(*)
    FROM public.content_topics ct
    WHERE ct.content_id = drops.id
  ) as actual_topic_count
FROM public.drops
ORDER BY id DESC;