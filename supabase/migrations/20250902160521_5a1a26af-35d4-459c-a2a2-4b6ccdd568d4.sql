-- Mark all pending OpenAI URLs as permanent failures since they consistently return 403 Forbidden
UPDATE public.ingestion_queue 
SET status = 'error',
    error = 'Permanent failure: OpenAI blocks automated scraping (403 Forbidden)',
    updated_at = NOW()
WHERE status = 'pending' 
AND url LIKE '%openai.com%';