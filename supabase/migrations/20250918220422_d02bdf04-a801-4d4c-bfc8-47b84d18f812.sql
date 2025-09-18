-- Fix profiles table RLS security issue
-- Remove conflicting SELECT policies and create a single secure policy

-- Drop the conflicting SELECT policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

-- Create a single, secure SELECT policy that handles both cases properly
CREATE POLICY "secure_profiles_select" ON public.profiles
FOR SELECT 
USING (
  -- Users can always view their own profile
  auth.uid() = id 
  OR 
  -- Admins can view all profiles, but only if they are authenticated and have admin role
  (
    auth.uid() IS NOT NULL 
    AND is_admin_user()
  )
);

-- Ensure the admin management policy is also secure
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create separate policies for admin operations to be more explicit
CREATE POLICY "secure_profiles_admin_update" ON public.profiles
FOR UPDATE 
USING (
  -- Users can update their own profile OR admins can update any profile
  auth.uid() = id OR (auth.uid() IS NOT NULL AND is_admin_user())
)
WITH CHECK (
  -- Same check for updates
  auth.uid() = id OR (auth.uid() IS NOT NULL AND is_admin_user())
);

CREATE POLICY "secure_profiles_admin_delete" ON public.profiles
FOR DELETE 
USING (
  -- Users can delete their own profile OR admins can delete any profile  
  auth.uid() = id OR (auth.uid() IS NOT NULL AND is_admin_user())
);

-- Ensure INSERT policy is secure (users can only create their own profile)
DROP POLICY IF EXISTS "Users can insert own profile only" ON public.profiles;
CREATE POLICY "secure_profiles_insert" ON public.profiles
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Remove the individual user policies that are now covered by the consolidated policies
DROP POLICY IF EXISTS "Users can delete own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile only" ON public.profiles;