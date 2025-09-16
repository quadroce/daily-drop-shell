-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to drops table (idempotent)
ALTER TABLE public.drops
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create user_profile_vectors table (idempotent)
CREATE TABLE IF NOT EXISTS public.user_profile_vectors (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_vec vector(1536) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_profile_vectors
ALTER TABLE public.user_profile_vectors ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_profile_vectors (drop if exists first)
DROP POLICY IF EXISTS "Users can manage own profile vectors" ON public.user_profile_vectors;
CREATE POLICY "Users can manage own profile vectors" 
ON public.user_profile_vectors 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create ANN index on drops.embedding using HNSW if available, otherwise IVF
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS drops_embedding_hnsw
             ON public.drops USING hnsw (embedding vector_cosine_ops)
             WITH (m=16, ef_construction=64)';
  EXCEPTION WHEN others THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS drops_embedding_ivf
             ON public.drops USING ivfflat (embedding vector_cosine_ops)
             WITH (lists=100)';
  END;
END$$;