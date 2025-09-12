-- Create youtube_cache table for caching API responses
CREATE TABLE IF NOT EXISTS public.youtube_cache (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_youtube_cache_video_id ON public.youtube_cache(video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_expires ON public.youtube_cache(expires_at);

-- Enable RLS
ALTER TABLE public.youtube_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role access (for edge functions)
CREATE POLICY "Service role can manage youtube cache" ON public.youtube_cache
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');