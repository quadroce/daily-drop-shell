-- Add dedup_key to delivery_log for idempotency
ALTER TABLE public.delivery_log 
ADD COLUMN dedup_key text;

-- Create index on dedup_key for fast lookups
CREATE INDEX idx_delivery_log_dedup_key ON public.delivery_log(dedup_key);

-- Add constraint to prevent duplicate dedup_keys
ALTER TABLE public.delivery_log 
ADD CONSTRAINT unique_dedup_key UNIQUE (dedup_key);