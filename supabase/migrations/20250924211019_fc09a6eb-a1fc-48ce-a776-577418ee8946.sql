-- Insert the missing auto-ingest-worker record into cron_jobs table
INSERT INTO public.cron_jobs (name, enabled, created_at, updated_at)
VALUES ('auto-ingest-worker', false, now(), now())
ON CONFLICT (name) DO NOTHING;