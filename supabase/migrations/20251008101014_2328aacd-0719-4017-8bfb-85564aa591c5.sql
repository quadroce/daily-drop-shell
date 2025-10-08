-- Create storage bucket for YouTube Shorts assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shorts-assets',
  'shorts-assets',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'video/mp4', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to shorts assets
CREATE POLICY "Public Access for Shorts Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'shorts-assets');

-- Allow authenticated users to upload shorts assets
CREATE POLICY "Authenticated Upload Shorts Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shorts-assets');

-- Allow service role to manage shorts assets (for edge functions)
CREATE POLICY "Service Role Manage Shorts Assets"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'shorts-assets');