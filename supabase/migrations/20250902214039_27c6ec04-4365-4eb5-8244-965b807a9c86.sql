-- Enable pgvector extension for embeddings support
CREATE EXTENSION IF NOT EXISTS vector;

-- Add ranking fields to drops table
ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS authority_score DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS popularity_score DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE public.drops ADD COLUMN IF NOT EXISTS embeddings vector(1536); -- OpenAI embeddings dimension

-- Add preference embeddings to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preference_embeddings vector(1536);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS drops_embeddings_idx ON public.drops USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS profiles_preference_embeddings_idx ON public.profiles USING ivfflat (preference_embeddings vector_cosine_ops) WITH (lists = 100);

-- Create function to calculate recency score (exponential decay)
CREATE OR REPLACE FUNCTION calculate_recency_score(published_date timestamp with time zone)
RETURNS decimal(3,2) AS $$
DECLARE
    hours_old integer;
    recency_score decimal(3,2);
BEGIN
    -- Calculate hours since publication
    hours_old := EXTRACT(epoch FROM (now() - published_date)) / 3600;
    
    -- Exponential decay: 100% at publish, 50% after 48h, near 0 after 7 days (168h)
    -- Formula: e^(-hours_old * ln(2) / 48) for half-life of 48 hours
    recency_score := exp(-hours_old * ln(2.0) / 48.0);
    
    -- Clamp between 0 and 1
    recency_score := GREATEST(0.0, LEAST(1.0, recency_score));
    
    RETURN recency_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to calculate popularity score (log-normalized)
CREATE OR REPLACE FUNCTION calculate_popularity_score(raw_popularity decimal)
RETURNS decimal(3,2) AS $$
DECLARE
    normalized_score decimal(3,2);
BEGIN
    -- Log normalization to prevent viral content from dominating
    -- Using log10(1 + raw_popularity) and normalizing to 0-1 range
    normalized_score := log(1 + COALESCE(raw_popularity, 0)) / log(1000); -- Assuming max popularity around 1000
    
    -- Clamp between 0 and 1
    normalized_score := GREATEST(0.0, LEAST(1.0, normalized_score));
    
    RETURN normalized_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get user feedback score for a drop
CREATE OR REPLACE FUNCTION get_user_feedback_score(_user_id uuid, _drop_id bigint, _source_id bigint, _tags text[])
RETURNS decimal(3,2) AS $$
DECLARE
    feedback_score decimal(3,2) := 0.0;
    like_count integer;
    save_count integer;
    dismiss_count integer;
    source_like_count integer;
    tag_like_count integer;
BEGIN
    -- Direct engagement with this drop
    SELECT 
        COALESCE(SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'save' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'dismiss' THEN 1 ELSE 0 END), 0)
    INTO like_count, save_count, dismiss_count
    FROM public.engagement_events ee
    WHERE ee.user_id = _user_id AND ee.drop_id = _drop_id;
    
    -- Apply direct feedback
    feedback_score := feedback_score + (like_count * 0.3) + (save_count * 0.4) - (dismiss_count * 0.3);
    
    -- Source-based feedback (if user liked/saved content from same source)
    SELECT COUNT(*)
    INTO source_like_count
    FROM public.engagement_events ee
    JOIN public.drops d ON ee.drop_id = d.id
    WHERE ee.user_id = _user_id 
        AND d.source_id = _source_id 
        AND ee.action IN ('like', 'save')
        AND ee.drop_id != _drop_id;
    
    -- Boost for liked sources (max 0.2)
    feedback_score := feedback_score + LEAST(0.2, source_like_count * 0.05);
    
    -- Tag-based feedback (if user liked content with similar tags)
    SELECT COUNT(*)
    INTO tag_like_count
    FROM public.engagement_events ee
    JOIN public.drops d ON ee.drop_id = d.id
    WHERE ee.user_id = _user_id 
        AND ee.action IN ('like', 'save')
        AND d.tags && _tags -- Array overlap operator
        AND ee.drop_id != _drop_id;
    
    -- Boost for liked topics (max 0.1)
    feedback_score := feedback_score + LEAST(0.1, tag_like_count * 0.02);
    
    -- Clamp between -0.5 and 0.5
    feedback_score := GREATEST(-0.5, LEAST(0.5, feedback_score));
    
    RETURN feedback_score;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;