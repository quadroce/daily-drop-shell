-- Add YouTube-specific columns to drops table
ALTER TABLE public.drops 
ADD COLUMN youtube_video_id TEXT,
ADD COLUMN youtube_channel_id TEXT,
ADD COLUMN youtube_published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN youtube_category TEXT,
ADD COLUMN youtube_duration_seconds INTEGER,
ADD COLUMN youtube_view_count BIGINT,
ADD COLUMN youtube_thumbnail_url TEXT;

-- Create YouTube cache table for API response caching
CREATE TABLE public.youtube_cache (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  video_id TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on youtube_cache
ALTER TABLE public.youtube_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to access youtube_cache (for edge functions)
CREATE POLICY "Allow service role access to youtube_cache" 
ON public.youtube_cache 
FOR ALL 
TO service_role
USING (true);

-- Create index for efficient lookups
CREATE INDEX idx_youtube_cache_video_id ON public.youtube_cache(video_id);
CREATE INDEX idx_youtube_cache_expires_at ON public.youtube_cache(expires_at);

-- Add index on drops table for YouTube video lookups
CREATE INDEX idx_drops_youtube_video_id ON public.drops(youtube_video_id) WHERE youtube_video_id IS NOT NULL;