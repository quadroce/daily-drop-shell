-- Fix remaining RLS issue for topics_backup table
ALTER TABLE public.topics_backup ENABLE ROW LEVEL SECURITY;

-- Create read-only policy for topics_backup (admin only since it's backup data)
CREATE POLICY "topics_backup_admin_only" ON public.topics_backup 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );