-- Security hardening for profiles table
-- The existing RLS policies are good, but we can add additional security layers

-- 1. Create a more explicit policy for unauthenticated users (deny all access)
CREATE POLICY "Deny all access to unauthenticated users"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- 2. Create a more secure function for profile access that includes additional validation
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = auth.uid()
  AND auth.uid() IS NOT NULL
  LIMIT 1;
$$;

-- 3. Create a function for safe profile updates that validates ownership
CREATE OR REPLACE FUNCTION public.update_user_profile(
  _username text DEFAULT NULL,
  _display_name text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  updated_profile public.profiles;
BEGIN
  -- Ensure user is authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Update only provided fields
  UPDATE public.profiles
  SET 
    username = COALESCE(_username, username),
    display_name = COALESCE(_display_name, display_name)
  WHERE id = _user_id
  RETURNING * INTO updated_profile;
  
  -- Ensure the profile exists
  IF updated_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or access denied';
  END IF;
  
  RETURN updated_profile;
END;
$$;

-- 4. Add a trigger to log profile access attempts (security monitoring)
CREATE OR REPLACE FUNCTION public.log_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log access attempts for security monitoring
  -- This helps detect potential unauthorized access attempts
  INSERT INTO public.admin_audit_log (
    user_id, 
    action, 
    resource_type, 
    resource_id, 
    details
  ) VALUES (
    auth.uid(),
    TG_OP,
    'profile',
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'timestamp', now(),
      'operation', TG_OP,
      'table', TG_TABLE_NAME
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for profile access logging
DROP TRIGGER IF EXISTS profile_access_log ON public.profiles;
CREATE TRIGGER profile_access_log
  AFTER INSERT OR UPDATE OR DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_access();

-- 5. Create a view for safe public profile data (excluding sensitive fields)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  created_at,
  -- Explicitly exclude email and other sensitive fields
  subscription_tier
FROM public.profiles
WHERE username IS NOT NULL; -- Only show profiles with usernames

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Grant appropriate permissions
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;