-- Create settings table for admin-configurable features
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read settings
CREATE POLICY "settings_public_read" ON public.settings
  FOR SELECT USING (true);

-- Policy: Only admins can modify settings
CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Seed initial settings (idempotent)
INSERT INTO public.settings (key, value) VALUES
  ('show_alpha_ribbon', '{"enabled": true}'),
  ('show_feedback_button', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;