-- Ottimizzazioni performance feed - FIXED
-- 1. Cache più frequente: da 24h a 12h con cron ogni 12h  
-- 2. Trigger per cache immediata dopo onboarding
-- 3. Indici ottimizzati per query fallback
-- 4. Pre-caricamento intelligente

-- Modifica cache per 12 ore
ALTER TABLE public.user_feed_cache 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 hours');

-- Crea cron ogni 12 ore (6:00 e 18:00 UTC)
SELECT cron.schedule(
  'background-feed-ranking-12h',
  '0 6,18 * * *', -- Ogni 12 ore alle 6:00 e 18:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "cron_12h"}'::jsonb
  );
  $$
);

-- Aggiungi pre-caricamento intelligente ogni 4 ore durante il giorno
SELECT cron.schedule(
  'feed-preload-smart',
  '0 4,8,12,16 * * *', -- Ogni 4 ore durante il giorno
  $$
  SELECT net.http_post(
    url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
    body := '{"trigger": "preload", "users_limit": 100}'::jsonb
  );
  $$
);

-- Ottimizza indici per query fallback (senza WHERE clause con now())
CREATE INDEX IF NOT EXISTS idx_drops_performance_fallback 
ON public.drops (tag_done, published_at DESC, l1_topic_id, l2_topic_id, language);

CREATE INDEX IF NOT EXISTS idx_user_feed_cache_performance 
ON public.user_feed_cache (user_id, created_at DESC, position);

-- Funzione per trigger cache immediata dopo onboarding
CREATE OR REPLACE FUNCTION trigger_immediate_feed_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo quando onboarding_completed diventa true
  IF OLD.onboarding_completed = false AND NEW.onboarding_completed = true THEN
    -- Trigger asincrono per background-feed-ranking per questo specifico utente
    PERFORM net.http_post(
      url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
      body := format('{"trigger": "onboarding_completed", "user_id": "%s"}', NEW.id)::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aggiungi trigger su profiles per onboarding completato
DROP TRIGGER IF EXISTS trg_immediate_feed_cache ON public.profiles;
CREATE TRIGGER trg_immediate_feed_cache
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_immediate_feed_cache();