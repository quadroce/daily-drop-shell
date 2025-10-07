-- Create social_comment_jobs table
CREATE TABLE IF NOT EXISTS public.social_comment_jobs (
  id bigserial PRIMARY KEY,
  platform text NOT NULL DEFAULT 'youtube',
  video_id text NOT NULL,
  channel_id text NOT NULL,
  topic_slug text NOT NULL,
  video_title text,
  video_description text,
  locale text NOT NULL DEFAULT 'en',
  text_hash text NOT NULL UNIQUE,
  text_original text,
  status text NOT NULL DEFAULT 'queued',
  tries int NOT NULL DEFAULT 0,
  last_error text,
  external_comment_id text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  next_retry_at timestamptz
);

-- Create social_comment_events table for detailed logging
CREATE TABLE IF NOT EXISTS public.social_comment_events (
  id bigserial PRIMARY KEY,
  job_id bigint REFERENCES public.social_comment_jobs(id) ON DELETE CASCADE,
  phase text NOT NULL,
  status text NOT NULL,
  message text,
  data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_social_comment_jobs_status ON public.social_comment_jobs(status);
CREATE INDEX idx_social_comment_jobs_video_id ON public.social_comment_jobs(video_id);
CREATE INDEX idx_social_comment_jobs_created_at ON public.social_comment_jobs(created_at);
CREATE INDEX idx_social_comment_events_job_id ON public.social_comment_events(job_id);

-- Enable RLS
ALTER TABLE public.social_comment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can access
CREATE POLICY "Admin access social_comment_jobs"
  ON public.social_comment_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admin access social_comment_events"
  ON public.social_comment_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Function to get today's comment count
CREATE OR REPLACE FUNCTION public.get_youtube_comments_today_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM social_comment_jobs
  WHERE status = 'posted'
    AND platform = 'youtube'
    AND posted_at >= CURRENT_DATE;
$$;