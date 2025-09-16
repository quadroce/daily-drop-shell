-- Add is_active flag to profiles for soft delete
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create index for performance on is_active lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Update existing RLS policies to respect is_active flag
-- Users can view their own profile or admins can view all active profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (
  (auth.uid() = id) OR 
  (is_admin_user() AND is_active = true)
);

-- Admins can view all profiles (including inactive for management)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (is_admin_user());