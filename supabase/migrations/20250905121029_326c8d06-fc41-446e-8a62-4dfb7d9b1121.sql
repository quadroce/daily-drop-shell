-- Enable RLS on topics table
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Allow public read access to topics
CREATE POLICY "topics_public_read" 
ON public.topics 
FOR SELECT 
USING (is_active = true);