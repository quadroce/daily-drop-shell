-- Fix RLS policies for profiles and whatsapp_subscriptions tables
-- Ensure they are not publicly readable

-- First, check and ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any potentially problematic policies and recreate them properly
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- Recreate secure policies for profiles table
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile only"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile only"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Fix whatsapp_subscriptions table RLS
ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "wa_owner" ON public.whatsapp_subscriptions;
DROP POLICY IF EXISTS "whatsapp_owner" ON public.whatsapp_subscriptions;

-- Recreate secure policies for whatsapp_subscriptions
CREATE POLICY "Users can manage own whatsapp subscription"
ON public.whatsapp_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure no public access to sensitive data
-- Revoke any public permissions on these tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.whatsapp_subscriptions FROM anon;
REVOKE ALL ON public.whatsapp_subscriptions FROM public;

-- Grant appropriate permissions only to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_subscriptions TO authenticated;