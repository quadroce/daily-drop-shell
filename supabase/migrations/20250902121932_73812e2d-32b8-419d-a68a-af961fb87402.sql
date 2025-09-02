-- 003_function_security_fixes.sql - Fix function search path security

-- Update existing functions to have proper search_path set
CREATE OR REPLACE FUNCTION public.check_max_3_languages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF array_length(new.selected_language_ids, 1) > 3 THEN
    RAISE EXCEPTION 'Max 3 languages per user';
  END IF;
  RETURN new;
END;
$$;