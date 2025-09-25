-- Chiamata diretta a background-feed-ranking per l'utente specifico
SELECT net.http_post(
  url := 'https://qimelntuxquptqqynxzv.supabase.co/functions/v1/background-feed-ranking',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWVsbnR1eHF1cHRxcXlueHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5ODIsImV4cCI6MjA3MjI5NDk4Mn0.Rt1gvo1wbLKDTtoagWdSOzX0ute2qWbsPtNIgA2bDpQ"}'::jsonb,
  body := '{"trigger": "manual", "user_id": "637fc77f-93aa-488a-a0e1-ebd00826d4b3"}'::jsonb
) as request_id;