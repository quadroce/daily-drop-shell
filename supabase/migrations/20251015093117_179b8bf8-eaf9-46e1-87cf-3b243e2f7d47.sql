-- Add title and logo_url to partners table
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.partners.title IS 'Custom page title (optional, defaults to name)';
COMMENT ON COLUMN public.partners.logo_url IS 'Partner logo URL (optional)';

-- Make partner_links optional by removing constraint
-- Links are now optional, not required to be exactly 2