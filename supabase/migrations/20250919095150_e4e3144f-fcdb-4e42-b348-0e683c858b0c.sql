-- Function to manually trigger onboarding reminders test
CREATE OR REPLACE FUNCTION trigger_onboarding_reminders_test()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow admins to trigger manually
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Only admins can trigger onboarding reminders test';
  END IF;

  -- Call the onboarding reminders function
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/send-onboarding-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "manual_test"}'::jsonb
  ) INTO result;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Manual onboarding reminders test triggered',
    'http_response', result
  );
END;
$$;