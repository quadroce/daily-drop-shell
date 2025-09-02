-- Check and move any remaining extensions from public schema
-- First check what extensions exist in public schema
SELECT schemaname, extname 
FROM pg_extension 
JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid 
WHERE schemaname = 'public';

-- Move any custom extensions to the proper schema
-- Note: Some Supabase extensions may need to remain in public schema