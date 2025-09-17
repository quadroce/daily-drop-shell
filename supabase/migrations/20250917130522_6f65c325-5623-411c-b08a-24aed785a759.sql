-- Clean up existing malformed URLs in the ingestion queue
-- These are URLs that contain JSON arrays instead of actual URLs
DELETE FROM public.ingestion_queue 
WHERE url LIKE '[{%' OR url LIKE '%}]' OR url LIKE '%"@_%';

-- Add a check constraint to prevent malformed URLs from being inserted
-- This will validate that the URL starts with http:// or https://
ALTER TABLE public.ingestion_queue 
ADD CONSTRAINT valid_url_format 
CHECK (url ~ '^https?://.*');