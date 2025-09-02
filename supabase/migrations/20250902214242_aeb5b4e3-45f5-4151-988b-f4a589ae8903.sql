-- Fix security issues: Add search_path to functions
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
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

-- Fix search path for popularity function
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
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;