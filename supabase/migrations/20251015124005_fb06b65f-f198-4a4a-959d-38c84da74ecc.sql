-- Add allowed_language_codes column to partners table
ALTER TABLE public.partners 
ADD COLUMN allowed_language_codes text[] DEFAULT '{}';

COMMENT ON COLUMN public.partners.allowed_language_codes IS 'Array of language codes that are allowed for this partner. Empty array means all languages are allowed.';