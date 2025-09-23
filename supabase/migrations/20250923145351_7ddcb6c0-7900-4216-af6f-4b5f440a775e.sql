-- Drop the duplicate function to resolve overloading issue
DROP FUNCTION IF EXISTS public.feed_get_page_drops(p_user_id uuid, p_cursor text, p_language text, p_l1 bigint, p_l2 bigint, p_limit integer);

-- Keep only the version with the correct parameter order
-- This function should already exist from the previous migration