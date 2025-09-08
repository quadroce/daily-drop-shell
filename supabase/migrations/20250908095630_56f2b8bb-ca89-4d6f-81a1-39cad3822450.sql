-- Aggiorna enum per includere editor se non esiste già
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'editor' AND enumtypid = 'app_role'::regtype) THEN
        ALTER TYPE app_role ADD VALUE 'editor';
    END IF;
END$$;

-- Crea vista drops_view che unisce drops con sources e topics
CREATE OR REPLACE VIEW drops_view AS
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

-- Crea tabella tagging_params per parametri globali di tagging
CREATE TABLE IF NOT EXISTS tagging_params (
    id BIGSERIAL PRIMARY KEY,
    param_name TEXT UNIQUE NOT NULL,
    param_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES profiles(id)
);

-- Inserisci parametri default
INSERT INTO tagging_params (param_name, param_value, description) VALUES
('similarity_threshold', '0.75', 'Soglia di similarità per il tagging automatico'),
('max_topics_per_drop', '5', 'Numero massimo di topics per articolo'),
('quality_boost', '1.2', 'Moltiplicatore per articoli di alta qualità'),
('recency_boost', '1.1', 'Moltiplicatore per articoli recenti')
ON CONFLICT (param_name) DO NOTHING;

-- Crea tabella admin_audit_log per audit delle azioni admin
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Abilita RLS sulle nuove tabelle
ALTER TABLE tagging_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy per tagging_params (solo editor e admin possono vedere/modificare)
CREATE POLICY "tagging_params_admin_access" ON tagging_params
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('editor', 'admin', 'superadmin')
))
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('editor', 'admin', 'superadmin')
));

-- Policy per admin_audit_log (solo admin possono vedere tutto, editor solo le proprie azioni)
CREATE POLICY "audit_log_admin_read" ON admin_audit_log
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin')
    )
    OR user_id = auth.uid()
);

CREATE POLICY "audit_log_editor_insert" ON admin_audit_log
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('editor', 'admin', 'superadmin')
    )
);

-- Crea funzione per logging audit
CREATE OR REPLACE FUNCTION log_admin_action(
    _action TEXT,
    _resource_type TEXT,
    _resource_id TEXT DEFAULT NULL,
    _details JSONB DEFAULT NULL
) 
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO admin_audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), _action, _resource_type, _resource_id, _details);
END;
$$;

-- Crea funzioni per le operazioni admin
CREATE OR REPLACE FUNCTION admin_update_drop_tags(
    _drop_id BIGINT,
    _topic_ids BIGINT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verifica permessi
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('editor', 'admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Accesso negato: solo editor e admin possono modificare i tag';
    END IF;
    
    -- Aggiorna i topics
    PERFORM set_article_topics(_drop_id, _topic_ids);
    
    -- Log dell'azione
    PERFORM log_admin_action('update_tags', 'drop', _drop_id::TEXT, 
        jsonb_build_object('topic_ids', _topic_ids));
END;
$$;

CREATE OR REPLACE FUNCTION admin_soft_delete_drop(_drop_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verifica permessi
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Accesso negato: solo admin possono eliminare articoli';
    END IF;
    
    -- Soft delete (aggiungi tag "deleted")
    UPDATE drops 
    SET tags = array_append(tags, 'deleted')
    WHERE id = _drop_id 
    AND NOT ('deleted' = ANY(tags));
    
    -- Log dell'azione
    PERFORM log_admin_action('soft_delete', 'drop', _drop_id::TEXT, NULL);
END;
$$;