-- Fix profiles table security by updating RLS policies to be more restrictive

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

-- Create new restrictive policies that only allow authenticated users to access their own data
CREATE POLICY "Users can view their own profile"
  ON public.profiles 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"  
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Add policy to allow users to delete their own profile (optional but good for GDPR compliance)
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated  
  USING (auth.uid() = id);