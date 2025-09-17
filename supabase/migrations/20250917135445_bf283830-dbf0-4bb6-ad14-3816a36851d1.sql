-- Add cron jobs for automated embeddings and profile refresh
INSERT INTO public.cron_jobs (name, enabled)
VALUES 
  ('embeddings-hourly', true),
  ('profiles-daily', true)
ON CONFLICT (name) DO UPDATE SET
  enabled = EXCLUDED.enabled;