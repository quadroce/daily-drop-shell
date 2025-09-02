-- Allow admins to read ingestion_queue
CREATE POLICY "admin_read_ingestion_queue" ON public.ingestion_queue
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);