-- Create table to cache YouTube OAuth tokens
CREATE TABLE IF NOT EXISTS public.youtube_oauth_cache (
  id BIGINT PRIMARY KEY DEFAULT 1,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE public.youtube_oauth_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Only service_role and admins can access
CREATE POLICY "Service role and admins can manage YouTube OAuth cache"
ON public.youtube_oauth_cache
FOR ALL
USING (
  (auth.jwt() ->> 'role' = 'service_role') OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Create index for expiration check
CREATE INDEX IF NOT EXISTS idx_youtube_oauth_expires_at ON public.youtube_oauth_cache(expires_at);