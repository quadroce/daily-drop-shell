-- Fix security issues from previous migration

-- 1. Ricrea la vista drops_view senza SECURITY DEFINER
DROP VIEW IF EXISTS drops_view;

CREATE VIEW drops_view AS
SELECT 
    d.id,
    d.title,
    d.url,
    d.image_url,
    d.summary,
    d.type,
    d.tags,
    d.created_at,
    d.published_at,
    d.tag_done,
    d.quality_score,
    d.authority_score,
    d.popularity_score,
    s.name as source_name,
    s.id as source_id,
    -- Aggregate topic labels
    COALESCE(
        array_agg(t.label ORDER BY t.level, t.label) FILTER (WHERE t.id IS NOT NULL), 
        '{}'::text[]
    ) as topic_labels
FROM drops d
LEFT JOIN sources s ON d.source_id = s.id
LEFT JOIN content_topics ct ON d.id = ct.content_id
LEFT JOIN topics t ON ct.topic_id = t.id
GROUP BY d.id, d.title, d.url, d.image_url, d.summary, d.type, d.tags, 
         d.created_at, d.published_at, d.tag_done, d.quality_score, 
         d.authority_score, d.popularity_score, s.name, s.id;

-- 2. Fix search_path for functions that don't have it
-- Ricreare la funzione log_admin_action con search_path corretto
CREATE OR REPLACE FUNCTION log_admin_action(
    _action TEXT,
    _resource_type TEXT,
    _resource_id TEXT DEFAULT NULL,
    _details JSONB DEFAULT NULL
) 
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO admin_audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), _action, _resource_type, _resource_id, _details);
END;
$$;

-- 3. Assicurarsi che tutte le altre funzioni abbiano search_path impostato correttamente  
-- (le funzioni admin_update_drop_tags e admin_soft_delete_drop già ce l'hanno)