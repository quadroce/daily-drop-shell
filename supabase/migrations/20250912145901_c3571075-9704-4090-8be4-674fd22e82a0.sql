-- Update the profiles table RLS policy to allow admins to see all profiles
-- First drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

-- Create new policies for better admin access
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'superadmin')
  )
);

-- Also ensure admins can manage profiles
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'superadmin')
  )
);