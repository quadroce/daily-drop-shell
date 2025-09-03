-- Create user_feed_cache table to store pre-calculated ranked drops
CREATE TABLE public.user_feed_cache (
  user_id UUID NOT NULL,
  drop_id BIGINT NOT NULL,
  final_score NUMERIC NOT NULL,
  reason_for_ranking TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '2 hours',
  PRIMARY KEY (user_id, drop_id)
);

-- Enable RLS
ALTER TABLE public.user_feed_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own cache" 
ON public.user_feed_cache 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_feed_cache_user_position ON public.user_feed_cache (user_id, position);
CREATE INDEX idx_user_feed_cache_expires ON public.user_feed_cache (expires_at);

-- Create index for cleanup of expired entries
CREATE INDEX idx_user_feed_cache_user_expires ON public.user_feed_cache (user_id, expires_at);