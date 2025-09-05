-- Fix critical security issues from previous migration

-- Enable RLS on topics table
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Create read-only policy for topics (public read access)
CREATE POLICY "topics_read_all" ON public.topics FOR SELECT USING (true);

-- Admin can manage topics
CREATE POLICY "topics_admin_all" ON public.topics 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );