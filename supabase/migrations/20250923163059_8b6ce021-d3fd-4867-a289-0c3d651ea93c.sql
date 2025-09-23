-- Drop the duplicate function with bigint parameters that's causing conflicts
DROP FUNCTION IF EXISTS public.feed_get_page_drops(uuid, integer, text, text, bigint, bigint);

-- Ensure we only have the correct function with integer parameters
-- (The correct one already exists from the previous migration)