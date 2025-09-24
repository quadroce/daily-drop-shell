-- Set English as default language for users without selected languages
UPDATE preferences 
SET selected_language_ids = ARRAY[1], -- English (ID: 1)
    updated_at = now()
WHERE selected_language_ids = ARRAY[]::bigint[] OR selected_language_ids IS NULL;