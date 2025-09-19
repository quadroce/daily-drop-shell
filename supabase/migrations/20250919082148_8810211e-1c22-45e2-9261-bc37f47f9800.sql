-- Create onboarding_state table for step-by-step save and recovery
CREATE TABLE public.onboarding_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  profile_data JSONB DEFAULT '{}',
  selected_topics BIGINT[] DEFAULT '{}',
  communication_prefs JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own onboarding state" 
ON public.onboarding_state 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_onboarding_state_user_id ON public.onboarding_state(user_id);
CREATE INDEX idx_onboarding_state_step ON public.onboarding_state(current_step);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_onboarding_state_updated_at
BEFORE UPDATE ON public.onboarding_state
FOR EACH ROW
EXECUTE FUNCTION public.update_onboarding_state_updated_at();

-- Add onboarding_abandonment_events table for analytics
CREATE TABLE public.onboarding_abandonment_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  reason TEXT,
  session_duration_seconds INTEGER,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_abandonment_events ENABLE ROW LEVEL SECURITY;

-- Policy for abandonment events
CREATE POLICY "Users can insert their own abandonment events" 
ON public.onboarding_abandonment_events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all abandonment events" 
ON public.onboarding_abandonment_events 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() 
  AND role IN ('admin', 'superadmin')
));

-- Add indexes for analytics queries
CREATE INDEX idx_abandonment_events_user_id ON public.onboarding_abandonment_events(user_id);
CREATE INDEX idx_abandonment_events_step ON public.onboarding_abandonment_events(step);
CREATE INDEX idx_abandonment_events_created_at ON public.onboarding_abandonment_events(created_at);