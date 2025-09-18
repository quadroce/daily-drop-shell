-- Fix Critical Security Issue: Remove public access to profiles table
-- This prevents unauthorized access to sensitive user data including emails, names, and personal information

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create secure policies that only allow authenticated users to access their own data

-- 1. Users can only view their own profile (authenticated users only)
CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- 2. Users can only insert their own profile (during signup)
CREATE POLICY "Users can insert own profile only" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Users can only update their own profile
CREATE POLICY "Users can update own profile only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Users can only delete their own profile
CREATE POLICY "Users can delete own profile only" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (auth.uid() = id);

-- 5. Admins can view all active profiles (authenticated admin users only)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  is_admin_user() OR auth.uid() = id
);

-- 6. Admins can manage all profiles (authenticated admin users only)
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Additional security: Revoke any direct public access
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;