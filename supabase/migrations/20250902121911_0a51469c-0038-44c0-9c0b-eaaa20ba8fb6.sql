-- 002_security_fixes.sql - Fix RLS and security issues

-- Enable RLS on public tables that don't have user-specific data but need protection
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for public readable tables (languages, topics, sources, drops)
DROP POLICY IF EXISTS "languages_public_read" ON public.languages;
CREATE POLICY "languages_public_read" ON public.languages
FOR SELECT USING (true);

DROP POLICY IF EXISTS "topics_public_read" ON public.topics;
CREATE POLICY "topics_public_read" ON public.topics
FOR SELECT USING (true);

DROP POLICY IF EXISTS "sources_public_read" ON public.sources;
CREATE POLICY "sources_public_read" ON public.sources
FOR SELECT USING (true);

DROP POLICY IF EXISTS "drops_public_read" ON public.drops;
CREATE POLICY "drops_public_read" ON public.drops
FOR SELECT USING (true);

-- Policies for user-specific tables that were missing RLS
DROP POLICY IF EXISTS "newsletter_owner" ON public.newsletter_subscriptions;
CREATE POLICY "newsletter_owner" ON public.newsletter_subscriptions
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_owner" ON public.whatsapp_subscriptions;
CREATE POLICY "whatsapp_owner" ON public.whatsapp_subscriptions
FOR ALL USING (auth.uid() = user_id);

-- Policies for admin/system tables (restrict access)
DROP POLICY IF EXISTS "corporate_sources_no_access" ON public.corporate_sources;
CREATE POLICY "corporate_sources_no_access" ON public.corporate_sources
FOR ALL USING (false);

DROP POLICY IF EXISTS "daily_batches_user_read" ON public.daily_batches;
CREATE POLICY "daily_batches_user_read" ON public.daily_batches
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_batch_items_user_read" ON public.daily_batch_items;
CREATE POLICY "daily_batch_items_user_read" ON public.daily_batch_items
FOR SELECT USING (EXISTS (
    SELECT 1 FROM daily_batches b 
    WHERE b.id = daily_batch_items.batch_id 
    AND b.user_id = auth.uid()
));

DROP POLICY IF EXISTS "ingestion_queue_no_access" ON public.ingestion_queue;
CREATE POLICY "ingestion_queue_no_access" ON public.ingestion_queue
FOR ALL USING (false);

DROP POLICY IF EXISTS "sponsor_contents_no_access" ON public.sponsor_contents;
CREATE POLICY "sponsor_contents_no_access" ON public.sponsor_contents
FOR ALL USING (false);