-- 001_core.sql - Core DailyDrops schema migration (idempotent)

DO $$ 
BEGIN
    -- Ensure sources table exists
    CREATE TABLE IF NOT EXISTS public.sources (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        feed_url TEXT,
        homepage_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        official BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Ensure languages table exists
    CREATE TABLE IF NOT EXISTS public.languages (
        id BIGSERIAL PRIMARY KEY,
        code TEXT NOT NULL,
        label TEXT NOT NULL
    );
    
    -- Ensure topics table exists
    CREATE TABLE IF NOT EXISTS public.topics (
        id BIGSERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        label TEXT NOT NULL
    );
    
    -- Ensure drop_type enum exists
    CREATE TYPE drop_type AS ENUM ('article', 'video', 'podcast', 'tool', 'other');
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure drops table exists with all required columns
CREATE TABLE IF NOT EXISTS public.drops (
    id BIGSERIAL PRIMARY KEY,
    type drop_type NOT NULL,
    source_id BIGINT,
    lang_id BIGINT,
    url TEXT NOT NULL,
    url_hash TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    image_url TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    score DOUBLE PRECISION DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to drops table if they don't exist
DO $$
BEGIN
    -- Add summary column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drops' AND column_name = 'summary') THEN
        ALTER TABLE public.drops ADD COLUMN summary TEXT;
    END IF;
    
    -- Add image_url column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drops' AND column_name = 'image_url') THEN
        ALTER TABLE public.drops ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure preferences table exists
CREATE TABLE IF NOT EXISTS public.preferences (
    user_id UUID PRIMARY KEY,
    selected_topic_ids BIGINT[] NOT NULL DEFAULT '{}',
    selected_language_ids BIGINT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure bookmarks table exists
CREATE TABLE IF NOT EXISTS public.bookmarks (
    user_id UUID NOT NULL,
    drop_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, drop_id)
);

-- Ensure engagement_events table exists
CREATE TABLE IF NOT EXISTS public.engagement_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    drop_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    channel TEXT NOT NULL,
    dwell_time_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes if they don't exist
DO $$
BEGIN
    -- Unique index on drops.url_hash
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_drops_url_hash_unique') THEN
        CREATE UNIQUE INDEX idx_drops_url_hash_unique ON public.drops (url_hash) WHERE url_hash IS NOT NULL;
    END IF;
    
    -- Index on drops.published_at for ordering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_drops_published_at_desc') THEN
        CREATE INDEX idx_drops_published_at_desc ON public.drops (published_at DESC NULLS LAST);
    END IF;
    
    -- Index on engagement_events for user queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_engagement_events_user_created') THEN
        CREATE INDEX idx_engagement_events_user_created ON public.engagement_events (user_id, created_at DESC);
    END IF;
END $$;

-- Enable RLS on all user-specific tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop if exists to ensure they're current)
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "prefs_owner" ON public.preferences;
CREATE POLICY "prefs_owner" ON public.preferences
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bm_owner" ON public.bookmarks;
CREATE POLICY "bm_owner" ON public.bookmarks
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "evt_owner_sel" ON public.engagement_events;
CREATE POLICY "evt_owner_sel" ON public.engagement_events
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "evt_owner_ins" ON public.engagement_events;
CREATE POLICY "evt_owner_ins" ON public.engagement_events
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function 1: ensure_profile - Create profiles row for auth.uid() if missing
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
    _uid uuid := auth.uid(); 
    _email text;
BEGIN
    /* Purpose: Ensure a profile exists for the current authenticated user */
    IF _uid IS NULL THEN 
        RAISE EXCEPTION 'Auth required: no user in JWT'; 
    END IF;
    
    SELECT email INTO _email FROM auth.users WHERE id = _uid;
    
    INSERT INTO public.profiles (id, email)
    VALUES (_uid, COALESCE(_email, ''))
    ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Function 2: upsert_preferences - Save user topic/language preferences
CREATE OR REPLACE FUNCTION public.upsert_preferences(_topics bigint[], _langs bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
    _uid uuid := auth.uid();
BEGIN
    /* Purpose: Save user preferences for topics and languages */
    IF _uid IS NULL THEN 
        RAISE EXCEPTION 'Auth required: no user in JWT'; 
    END IF;
    
    -- Ensure profile exists first
    PERFORM public.ensure_profile();
    
    -- Upsert preferences
    INSERT INTO public.preferences (user_id, selected_topic_ids, selected_language_ids)
    VALUES (_uid, _topics, _langs)
    ON CONFLICT (user_id) DO UPDATE
    SET selected_topic_ids = EXCLUDED.selected_topic_ids,
        selected_language_ids = EXCLUDED.selected_language_ids,
        updated_at = now();
END;
$$;

-- Function 3: get_candidate_drops - Get drops filtered by user's language preferences
CREATE OR REPLACE FUNCTION public.get_candidate_drops(limit_n integer DEFAULT 10)
RETURNS SETOF public.drops
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    /* Purpose: Retrieve drops matching user's language preferences, ordered by recency */
    SELECT d.*
    FROM public.drops d
    WHERE COALESCE(d.lang_id, 0) = ANY (
        SELECT unnest(COALESCE(p.selected_language_ids, '{}'::bigint[]))
        FROM public.preferences p
        WHERE p.user_id = auth.uid()
    )
    ORDER BY COALESCE(d.published_at, d.created_at) DESC
    LIMIT limit_n;
$$;

-- Function 4: bookmark_upsert - Toggle bookmark for a drop
CREATE OR REPLACE FUNCTION public.bookmark_upsert(_drop_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
    _uid uuid := auth.uid();
BEGIN
    /* Purpose: Toggle bookmark status for a drop (upsert or delete) */
    IF _uid IS NULL THEN 
        RAISE EXCEPTION 'Auth required: no user in JWT'; 
    END IF;
    
    -- Try to insert, if exists then delete (toggle behavior)
    INSERT INTO public.bookmarks (user_id, drop_id)
    VALUES (_uid, _drop_id)
    ON CONFLICT (user_id, drop_id) DO NOTHING;
    
    -- If no insert happened, delete the existing bookmark
    IF NOT FOUND THEN
        DELETE FROM public.bookmarks 
        WHERE user_id = _uid AND drop_id = _drop_id;
    END IF;
END;
$$;

-- Function 5: record_engagement - Record user engagement event
CREATE OR REPLACE FUNCTION public.record_engagement(_drop_id bigint, _action text, _channel text DEFAULT 'web')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
    _uid uuid := auth.uid();
BEGIN
    /* Purpose: Record user engagement event for analytics */
    IF _uid IS NULL THEN 
        RAISE EXCEPTION 'Auth required: no user in JWT'; 
    END IF;
    
    INSERT INTO public.engagement_events (user_id, drop_id, action, channel)
    VALUES (_uid, _drop_id, _action, _channel);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_preferences(bigint[], bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_candidate_drops(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bookmark_upsert(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_engagement(bigint, text, text) TO authenticated;