-- Add missing columns to ingestion_queue table for manual ingestion functionality
ALTER TABLE public.ingestion_queue 
ADD COLUMN source_label TEXT,
ADD COLUMN notes TEXT;