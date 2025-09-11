-- Remove the view entirely to fix the security definer issue
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Instead of a view, let's just ensure the existing policies are properly configured
-- Remove the conflicting policy first
DROP POLICY IF EXISTS "Public profiles view access" ON public.profiles;

-- The existing policies are actually secure enough:
-- "Users can view own profile only" - this is good for authenticated access to own profile
-- We don't need public access to profiles containing emails

-- Instead, let's create a dedicated function for public profile lookups
-- that only returns non-sensitive data
CREATE OR REPLACE FUNCTION public.get_public_profile_by_username(_username text)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  created_at timestamptz,
  subscription_tier subscription_tier
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.created_at,
    p.subscription_tier
  FROM public.profiles p
  WHERE p.username = _username
    AND p.username IS NOT NULL
  LIMIT 1;
$$;

-- Grant execution permission to all users
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_username(text) TO authenticated, anon;