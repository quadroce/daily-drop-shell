-- Add foreign key constraint between onboarding_reminders and profiles
-- This will allow the nested select query in the edge function to work properly
ALTER TABLE public.onboarding_reminders 
ADD CONSTRAINT onboarding_reminders_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_user_id ON public.onboarding_reminders(user_id);

-- Add helpful function for manual testing of onboarding reminders
CREATE OR REPLACE FUNCTION public.trigger_onboarding_reminders_test()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admins to trigger manually
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Only admins can trigger onboarding reminders test';
  END IF;

  -- Trigger the onboarding reminders function
  PERFORM net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-onboarding-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "manual_test"}'::jsonb
  );

  RETURN true;
END;
$function$;