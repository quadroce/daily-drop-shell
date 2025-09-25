-- Prima rigenerazione della cache per l'utente specifico
SELECT net.http_post(
  url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/manual-user-cache',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
  body := '{"user_id": "637fc77f-93aa-488a-a0e1-ebd00826d4b3"}'::jsonb
) as request_id;

-- Aggiunta del cron job per background-feed-ranking se non esiste
INSERT INTO cron_jobs (name, enabled) 
VALUES ('background-feed-ranking-daily', true)
ON CONFLICT (name) DO UPDATE SET 
  enabled = true,
  updated_at = now();

-- Pulizia delivery log duplicati per l'utente
DELETE FROM delivery_log 
WHERE user_id = '637fc77f-93aa-488a-a0e1-ebd00826d4b3' 
AND dedup_key LIKE '%2025-09-25%' 
AND id NOT IN (
  SELECT MIN(id) 
  FROM delivery_log 
  WHERE user_id = '637fc77f-93aa-488a-a0e1-ebd00826d4b3' 
  AND dedup_key LIKE '%2025-09-25%'
  GROUP BY DATE(sent_at)
);

-- Sincronizzazione preferenze linguistiche
UPDATE profiles 
SET language_prefs = ARRAY['en'] 
WHERE id = '637fc77f-93aa-488a-a0e1-ebd00826d4b3' 
AND (language_prefs IS NULL OR language_prefs = '{}');