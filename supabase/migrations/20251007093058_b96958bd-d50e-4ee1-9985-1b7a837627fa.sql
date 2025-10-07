-- Create ingestion_priority table for temporary manual priorities
CREATE TABLE public.ingestion_priority (
  source_id bigint PRIMARY KEY REFERENCES public.sources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority_level int NOT NULL DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 10)
);

-- Enable RLS
ALTER TABLE public.ingestion_priority ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin can manage ingestion priorities"
ON public.ingestion_priority
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Index for performance
CREATE INDEX idx_ingestion_priority_created_at ON public.ingestion_priority(created_at);

-- Create ingestion_runs table to track run status and history
CREATE TABLE public.ingestion_runs (
  id bigserial PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'success', 'error')),
  items_ingested int DEFAULT 0,
  error_message text,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('scheduled', 'manual'))
);

-- Enable RLS
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Admin can view all runs
CREATE POLICY "Admin can view ingestion runs"
ON public.ingestion_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Service role can insert/update runs (for edge functions)
CREATE POLICY "Service role can manage ingestion runs"
ON public.ingestion_runs
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'service_role'
);

-- Index for latest run queries (most recent first per source)
CREATE INDEX idx_ingestion_runs_source_started ON public.ingestion_runs(source_id, started_at DESC);