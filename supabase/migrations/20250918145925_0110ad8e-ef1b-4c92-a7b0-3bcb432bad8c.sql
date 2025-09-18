-- Fix Security Definer View Issue: v_newsletter_targets
-- This view was exposing sensitive user data without proper RLS enforcement

-- Drop the existing view that bypasses RLS
DROP VIEW IF EXISTS public.v_newsletter_targets;

-- Create a secure function instead that respects RLS and user permissions
CREATE OR REPLACE FUNCTION public.get_newsletter_targets()
RETURNS TABLE(
  user_id uuid,
  cadence text,
  confirmed boolean,
  email text,
  subscription_tier subscription_tier
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow service_role or admin users to access newsletter targets
  IF NOT (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: only service_role or admin can access newsletter targets';
  END IF;

  RETURN QUERY
  SELECT 
    p.id AS user_id,
    COALESCE(ns.cadence,
      CASE
        WHEN p.subscription_tier IN ('premium', 'corporate', 'sponsor') THEN 'daily'
        ELSE 'weekly'
      END
    ) AS cadence,
    COALESCE(ns.confirmed, true) AS confirmed,
    p.email,
    p.subscription_tier
  FROM public.profiles p
  LEFT JOIN public.newsletter_subscriptions ns ON ns.user_id = p.id
  WHERE p.onboarding_completed = true 
    AND p.is_active = true 
    AND p.email IS NOT NULL 
    AND p.email != '';
END;
$$;

-- Grant execute permission only to service_role
REVOKE ALL ON FUNCTION public.get_newsletter_targets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_newsletter_targets() TO service_role;