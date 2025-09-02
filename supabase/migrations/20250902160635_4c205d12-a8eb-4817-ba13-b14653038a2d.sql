-- Try to move pg_net extension from public to extensions schema for security
-- Note: pg_net is used by Supabase for HTTP requests
ALTER EXTENSION pg_net SET SCHEMA extensions;