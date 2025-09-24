-- Migrate users who only have language_prefs to selected_language_ids
INSERT INTO preferences (user_id, selected_language_ids, selected_topic_ids)
SELECT p.id, 
       COALESCE(
         ARRAY(
           SELECT l.id 
           FROM languages l 
           WHERE l.code = ANY(p.language_prefs)
         ),
         ARRAY[1]::bigint[] -- Default to English if no valid languages found
       ) as selected_language_ids,
       ARRAY[]::bigint[] as selected_topic_ids
FROM profiles p
WHERE p.id NOT IN (SELECT user_id FROM preferences)
  AND (p.language_prefs IS NOT NULL AND array_length(p.language_prefs, 1) > 0)
ON CONFLICT (user_id) DO NOTHING;

-- Update existing preferences to include language_ids from language_prefs if they don't have any
UPDATE preferences 
SET selected_language_ids = COALESCE(
  NULLIF(selected_language_ids, ARRAY[]::bigint[]),
  COALESCE(
    ARRAY(
      SELECT l.id 
      FROM languages l 
      JOIN profiles p ON p.id = preferences.user_id
      WHERE l.code = ANY(p.language_prefs)
    ),
    ARRAY[1]::bigint[] -- Default to English
  )
),
updated_at = now()
WHERE (selected_language_ids = ARRAY[]::bigint[] OR selected_language_ids IS NULL);

-- Clear all language_prefs from profiles (set to empty array)
UPDATE profiles 
SET language_prefs = ARRAY[]::text[]
WHERE language_prefs != ARRAY[]::text[];