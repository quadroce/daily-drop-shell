-- Add username column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text;

-- Create unique index on username where not null (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key 
ON public.profiles (username) 
WHERE username IS NOT NULL;

-- Create or replace the public profile feed RPC function
CREATE OR REPLACE FUNCTION public.public_profile_feed(_username text)
RETURNS TABLE (
    drop_id bigint,
    title text,
    image_url text,
    url text,
    source_name text,
    saved_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    /* 
     * Returns the latest 10 saved bookmarks for a given username
     * Joins bookmarks with drops and sources tables
     * Excludes private user data (email, etc.)
     * Returns empty result if username not found
     */
    SELECT 
        d.id as drop_id,
        d.title,
        d.image_url,
        d.url,
        COALESCE(s.name, 'Unknown Source') as source_name,
        b.created_at as saved_at
    FROM public.bookmarks b
    INNER JOIN public.drops d ON b.drop_id = d.id
    LEFT JOIN public.sources s ON d.source_id = s.id
    INNER JOIN public.profiles p ON b.user_id = p.id
    WHERE p.username = _username
    ORDER BY b.created_at DESC
    LIMIT 10;
$$;

-- Grant execute permissions to anon and authenticated users (public access)
GRANT EXECUTE ON FUNCTION public.public_profile_feed(text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_profile_feed(text) TO authenticated;