-- Create storage bucket for partner assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-assets', 'partner-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for partner-assets bucket
CREATE POLICY "Public can view partner assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-assets');

CREATE POLICY "Admins can upload partner assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'partner-assets' 
  AND (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'editor')
  ))
);

CREATE POLICY "Admins can update partner assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'partner-assets' 
  AND (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'editor')
  ))
);

CREATE POLICY "Admins can delete partner assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'partner-assets' 
  AND (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'editor')
  ))
);