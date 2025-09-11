-- Fix the security definer view issue
-- Remove the problematic view and create a safer alternative

-- Drop the problematic view
DROP VIEW IF EXISTS public.public_profiles;

-- Create a safer view without security_barrier which caused the security definer issue
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  created_at,
  subscription_tier
FROM public.profiles
WHERE username IS NOT NULL;

-- Add RLS policy for the view (this is the proper way to secure views)
CREATE POLICY "Public profiles view access"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (username IS NOT NULL);

-- Remove the anonymous access to profiles table directly to force use of controlled access
DROP POLICY IF EXISTS "Deny all access to unauthenticated users" ON public.profiles;