-- Extend profiles table with new onboarding fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language_prefs text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube_embed_pref boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Add check constraint for language_prefs (max 3 languages)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'language_prefs_max_3') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT language_prefs_max_3 
        CHECK (array_length(language_prefs, 1) <= 3 OR language_prefs = '{}');
    END IF;
END $$;

-- Create user_topic_preferences table
CREATE TABLE IF NOT EXISTS public.user_topic_preferences (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id bigint REFERENCES public.topics(id) ON DELETE CASCADE,
    level smallint NOT NULL CHECK (level IN (1, 2, 3)),
    priority smallint,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, topic_id)
);

-- Enable RLS on user_topic_preferences
ALTER TABLE public.user_topic_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_topic_preferences
CREATE POLICY "Users can manage their own topic preferences"
ON public.user_topic_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to validate max 15 topics per user
CREATE OR REPLACE FUNCTION public.validate_max_user_topics()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) 
    FROM public.user_topic_preferences 
    WHERE user_id = NEW.user_id
  ) >= 15 THEN
    RAISE EXCEPTION 'Maximum 15 topics allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for max topics validation
DROP TRIGGER IF EXISTS validate_max_topics_trigger ON public.user_topic_preferences;
CREATE TRIGGER validate_max_topics_trigger
  BEFORE INSERT ON public.user_topic_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_max_user_topics();