-- Fixed migration: properly convert language codes to IDs
CREATE OR REPLACE FUNCTION migrate_user_topic_preferences()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_record RECORD;
  migrated_count INTEGER := 0;
BEGIN
  -- Migrate data from user_topic_preferences to preferences.selected_topic_ids
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM user_topic_preferences 
    WHERE user_id NOT IN (SELECT user_id FROM preferences)
  LOOP
    -- Create preferences record with topic IDs and language IDs
    INSERT INTO preferences (user_id, selected_topic_ids, selected_language_ids)
    SELECT 
      user_record.user_id,
      ARRAY_AGG(DISTINCT utp.topic_id) as selected_topic_ids,
      COALESCE(
        ARRAY(
          SELECT l.id 
          FROM languages l 
          WHERE l.code = ANY(
            COALESCE(
              (SELECT language_prefs FROM profiles WHERE id = user_record.user_id),
              ARRAY[]::text[]
            )
          )
        ),
        ARRAY[]::bigint[]
      ) as selected_language_ids
    FROM user_topic_preferences utp
    WHERE utp.user_id = user_record.user_id
    GROUP BY user_record.user_id;
    
    migrated_count := migrated_count + 1;
  END LOOP;

  -- For existing preferences records, merge topic IDs
  FOR user_record IN 
    SELECT DISTINCT utp.user_id 
    FROM user_topic_preferences utp
    INNER JOIN preferences p ON utp.user_id = p.user_id
  LOOP
    -- Merge existing preferences with user_topic_preferences
    UPDATE preferences 
    SET selected_topic_ids = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          COALESCE(selected_topic_ids, ARRAY[]::bigint[]) || 
          ARRAY(SELECT topic_id FROM user_topic_preferences WHERE user_id = user_record.user_id)
        )
      )
    )
    WHERE user_id = user_record.user_id;
    
    migrated_count := migrated_count + 1;
  END LOOP;

  RETURN migrated_count;
END;
$$;

-- Execute the migration
SELECT migrate_user_topic_preferences();

-- Add helper function to check if user is following a topic
CREATE OR REPLACE FUNCTION is_user_following_topic(_user_id uuid, _topic_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM preferences 
    WHERE user_id = _user_id 
    AND _topic_id = ANY(selected_topic_ids)
  );
$$;