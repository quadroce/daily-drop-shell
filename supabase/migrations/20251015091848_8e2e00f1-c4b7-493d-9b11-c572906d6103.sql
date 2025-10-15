-- Partner Pages System

-- 1. Partners table
CREATE TABLE IF NOT EXISTS public.partners (
  id bigserial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  scheduled_at timestamptz,
  banner_url text,
  youtube_url text,
  description_md text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_slug ON public.partners(slug);

-- 2. Partner Links (exactly 2 fixed slots)
CREATE TABLE IF NOT EXISTS public.partner_links (
  partner_id bigint REFERENCES public.partners(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position IN (1, 2)),
  label text NOT NULL,
  url text NOT NULL,
  utm text,
  PRIMARY KEY (partner_id, position)
);

-- 3. Partner Topics (associate partners with existing topics)
CREATE TABLE IF NOT EXISTS public.partner_topics (
  partner_id bigint REFERENCES public.partners(id) ON DELETE CASCADE,
  topic_id bigint REFERENCES public.topics(id) ON DELETE CASCADE,
  PRIMARY KEY (partner_id, topic_id)
);

-- 4. Partner Events (analytics tracking)
CREATE TABLE IF NOT EXISTS public.partner_events (
  id bigserial PRIMARY KEY,
  partner_id bigint REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid,
  type text NOT NULL CHECK (type IN ('view', 'link_click', 'follow_click')),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_events_partner ON public.partner_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_events_type ON public.partner_events(type);
CREATE INDEX IF NOT EXISTS idx_partner_events_created ON public.partner_events(created_at);

-- 5. Partner KPI View
CREATE OR REPLACE VIEW public.partner_kpi AS
SELECT
  p.id,
  p.slug,
  p.name,
  COUNT(DISTINCT CASE WHEN e.type = 'view' THEN e.id END)::bigint AS views,
  COUNT(DISTINCT CASE WHEN e.type = 'link_click' THEN e.id END)::bigint AS link_clicks,
  COUNT(DISTINCT CASE WHEN e.type = 'follow_click' THEN e.id END)::bigint AS follows
FROM public.partners p
LEFT JOIN public.partner_events e ON e.partner_id = p.id
GROUP BY p.id, p.slug, p.name;

-- RLS Policies

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_events ENABLE ROW LEVEL SECURITY;

-- Partners: Public can view published/scheduled
CREATE POLICY "Public can view published partners"
ON public.partners FOR SELECT
USING (
  status = 'published' OR 
  (status = 'scheduled' AND scheduled_at <= now())
);

-- Partners: Admins/editors can do everything
CREATE POLICY "Admins can manage partners"
ON public.partners FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'editor')
  )
);

-- Partner Links: Follow partner visibility
CREATE POLICY "Links visible with partner"
ON public.partner_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_id
    AND (p.status = 'published' OR (p.status = 'scheduled' AND p.scheduled_at <= now()))
  )
);

CREATE POLICY "Admins can manage partner links"
ON public.partner_links FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'editor')
  )
);

-- Partner Topics: Follow partner visibility
CREATE POLICY "Topics visible with partner"
ON public.partner_topics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_id
    AND (p.status = 'published' OR (p.status = 'scheduled' AND p.scheduled_at <= now()))
  )
);

CREATE POLICY "Admins can manage partner topics"
ON public.partner_topics FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'editor')
  )
);

-- Partner Events: Public can insert for tracking
CREATE POLICY "Anyone can track partner events"
ON public.partner_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view own events"
ON public.partner_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all events"
ON public.partner_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);