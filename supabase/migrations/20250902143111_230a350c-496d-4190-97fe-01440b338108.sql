-- Create unique indexes if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS uq_drops_url_hash ON public.drops(url_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_queue_url ON public.ingestion_queue(url);