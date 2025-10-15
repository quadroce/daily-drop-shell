-- Create table for daily topic summaries
CREATE TABLE IF NOT EXISTS public.daily_topic_summaries (
  id BIGSERIAL PRIMARY KEY,
  topic_slug TEXT NOT NULL,
  date DATE NOT NULL,
  summary_en TEXT NOT NULL,
  article_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(topic_slug, date)
);

-- Enable RLS
ALTER TABLE public.daily_topic_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: everyone can read summaries
CREATE POLICY "Anyone can read daily summaries"
  ON public.daily_topic_summaries
  FOR SELECT
  USING (true);

-- Policy: only admins can manage summaries
CREATE POLICY "Admins can manage daily summaries"
  ON public.daily_topic_summaries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Index for fast lookups
CREATE INDEX idx_daily_topic_summaries_lookup 
  ON public.daily_topic_summaries(topic_slug, date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_daily_topic_summaries_updated_at
  BEFORE UPDATE ON public.daily_topic_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_state_updated_at();