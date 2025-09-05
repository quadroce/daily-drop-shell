-- Migration to implement topic tagging level enforcement
-- Create content_topics junction table if not exists
CREATE TABLE IF NOT EXISTS public.content_topics (
  id bigserial PRIMARY KEY,
  content_id bigint NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(content_id, topic_id)
);

-- Create topic_keywords support table if not exists
CREATE TABLE IF NOT EXISTS public.topic_keywords (
  id bigserial PRIMARY KEY,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(topic_id)
);

-- Insert seed keyword data (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.topic_keywords LIMIT 1) THEN
    INSERT INTO public.topic_keywords (topic_id, keywords)
    SELECT t.id, 
      CASE t.slug
        WHEN 'artificial-intelligence' THEN ARRAY['ai', 'machine learning', 'deep learning', 'neural networks', 'automation']
        WHEN 'software-development' THEN ARRAY['coding', 'programming', 'dev', 'software', 'technology']
        WHEN 'product-management' THEN ARRAY['product', 'pm', 'roadmap', 'features', 'user experience']
        WHEN 'startups' THEN ARRAY['startup', 'entrepreneur', 'funding', 'venture capital', 'business']
        WHEN 'design' THEN ARRAY['ui', 'ux', 'interface', 'visual', 'graphics', 'user experience']
        WHEN 'marketing' THEN ARRAY['advertising', 'branding', 'social media', 'growth', 'seo']
        WHEN 'finance' THEN ARRAY['money', 'investment', 'financial', 'banking', 'economy']
        WHEN 'health' THEN ARRAY['medical', 'wellness', 'fitness', 'healthcare', 'nutrition']
        WHEN 'science' THEN ARRAY['research', 'study', 'scientific', 'discovery', 'innovation']
        WHEN 'sports' THEN ARRAY['football', 'basketball', 'soccer', 'athletics', 'games']
        ELSE ARRAY[]::text[]
      END
    FROM public.topics t
    WHERE t.level = 3 AND t.slug IN (
      'artificial-intelligence', 'software-development', 'product-management', 
      'startups', 'design', 'marketing', 'finance', 'health', 'science', 'sports'
    );
  END IF;
END $$;

-- Create or replace the set_article_topics RPC
CREATE OR REPLACE FUNCTION public.set_article_topics(
  _content_id bigint,
  _topic_ids bigint[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  level1_count int := 0;
  level2_count int := 0;
  level3_count int := 0;
  total_count int;
  topic_rec record;
BEGIN
  -- Only allow service_role or admin users
  IF NOT (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: only service_role or admin can set article topics';
  END IF;

  -- Validate content exists
  IF NOT EXISTS (SELECT 1 FROM public.drops WHERE id = _content_id) THEN
    RAISE EXCEPTION 'Content with id % does not exist', _content_id;
  END IF;

  -- Check for duplicates
  IF array_length(_topic_ids, 1) != (SELECT COUNT(DISTINCT unnest) FROM unnest(_topic_ids)) THEN
    RAISE EXCEPTION 'Duplicate topic IDs are not allowed';
  END IF;

  total_count := array_length(_topic_ids, 1);
  
  -- Check total count
  IF total_count > 5 THEN
    RAISE EXCEPTION 'Maximum 5 topics allowed per article, got %', total_count;
  END IF;

  -- Validate each topic and count levels
  FOR topic_rec IN 
    SELECT t.id, t.level 
    FROM public.topics t 
    WHERE t.id = ANY(_topic_ids)
  LOOP
    CASE topic_rec.level
      WHEN 1 THEN level1_count := level1_count + 1;
      WHEN 2 THEN level2_count := level2_count + 1;
      WHEN 3 THEN level3_count := level3_count + 1;
    END CASE;
  END LOOP;

  -- Check if all topics exist
  IF (SELECT COUNT(*) FROM public.topics WHERE id = ANY(_topic_ids)) != total_count THEN
    RAISE EXCEPTION 'One or more topic IDs do not exist';
  END IF;

  -- Validate level requirements
  IF level1_count != 1 THEN
    RAISE EXCEPTION 'Exactly 1 topic with level=1 required, got %', level1_count;
  END IF;

  IF level2_count != 1 THEN
    RAISE EXCEPTION 'Exactly 1 topic with level=2 required, got %', level2_count;
  END IF;

  IF level3_count < 1 THEN
    RAISE EXCEPTION 'At least 1 topic with level=3 required, got %', level3_count;
  END IF;

  -- Atomically replace all topics for this content
  DELETE FROM public.content_topics WHERE content_id = _content_id;
  
  INSERT INTO public.content_topics (content_id, topic_id)
  SELECT _content_id, unnest(_topic_ids);
END;
$$;

-- Drop existing constraint trigger if exists
DROP TRIGGER IF EXISTS content_topics_level_constraint ON public.content_topics;

-- Create constraint trigger function
CREATE OR REPLACE FUNCTION public.validate_content_topics_levels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  level1_count int;
  level2_count int;
  level3_count int;
  total_count int;
  content_id_to_check bigint;
BEGIN
  -- Determine which content_id to check based on operation
  IF TG_OP = 'DELETE' THEN
    content_id_to_check := OLD.content_id;
  ELSE
    content_id_to_check := NEW.content_id;
  END IF;

  -- Count topics by level for this content
  SELECT 
    COUNT(CASE WHEN t.level = 1 THEN 1 END),
    COUNT(CASE WHEN t.level = 2 THEN 1 END),
    COUNT(CASE WHEN t.level = 3 THEN 1 END),
    COUNT(*)
  INTO level1_count, level2_count, level3_count, total_count
  FROM public.content_topics ct
  JOIN public.topics t ON ct.topic_id = t.id
  WHERE ct.content_id = content_id_to_check;

  -- Check constraints
  IF total_count > 5 THEN
    RAISE EXCEPTION 'Maximum 5 topics allowed per article, content_id % has %', content_id_to_check, total_count;
  END IF;

  IF level1_count != 1 THEN
    RAISE EXCEPTION 'Exactly 1 topic with level=1 required for content_id %, got %', content_id_to_check, level1_count;
  END IF;

  IF level2_count != 1 THEN
    RAISE EXCEPTION 'Exactly 1 topic with level=2 required for content_id %, got %', content_id_to_check, level2_count;
  END IF;

  IF level3_count < 1 THEN
    RAISE EXCEPTION 'At least 1 topic with level=3 required for content_id %, got %', content_id_to_check, level3_count;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create deferrable constraint trigger
CREATE CONSTRAINT TRIGGER content_topics_level_constraint
  AFTER INSERT OR UPDATE OR DELETE ON public.content_topics
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_content_topics_levels();

-- Enable RLS on new tables
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_keywords ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "content_topics_read_all" ON public.content_topics FOR SELECT USING (true);
CREATE POLICY "topic_keywords_read_all" ON public.topic_keywords FOR SELECT USING (true);

-- Admin policies for content_topics
CREATE POLICY "content_topics_admin_all" ON public.content_topics 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Admin policies for topic_keywords  
CREATE POLICY "topic_keywords_admin_all" ON public.topic_keywords
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );