-- Create security definer function to check admin/editor role
CREATE OR REPLACE FUNCTION public.is_partner_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'editor')
  );
$$;

-- Drop existing policies that directly access profiles table
DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
DROP POLICY IF EXISTS "Admins can manage partner links" ON public.partner_links;
DROP POLICY IF EXISTS "Admins can manage partner topics" ON public.partner_topics;

-- Recreate policies using the security definer function
CREATE POLICY "Admins can manage partners" ON public.partners
FOR ALL
TO public
USING (public.is_partner_admin());

CREATE POLICY "Admins can manage partner links" ON public.partner_links
FOR ALL
TO public
USING (public.is_partner_admin());

CREATE POLICY "Admins can manage partner topics" ON public.partner_topics
FOR ALL
TO public
USING (public.is_partner_admin());