-- Update user vector on share function
CREATE OR REPLACE FUNCTION public.update_user_vector_on_share(p_user_id uuid, p_drop_id bigint, p_weight real DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item_vec vector(1536);
  v_curr_vec vector(1536);
  v_total real;
BEGIN
  -- 1) Pull the item's embedding (using embeddings column from drops table)
  SELECT d.embeddings
    INTO v_item_vec
    FROM public.drops d
   WHERE d.id = p_drop_id
     AND d.embeddings IS NOT NULL
   LIMIT 1;

  IF v_item_vec IS NULL THEN
    -- No-op if the item has no embedding
    RETURN;
  END IF;

  -- 2) Get current user vector state (or initialize)
  SELECT upv.profile_vec, upv.updated_at
    INTO v_curr_vec, v_total
    FROM public.user_profile_vectors upv
   WHERE upv.user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_profile_vectors (user_id, profile_vec, updated_at)
    VALUES (p_user_id, v_item_vec, now())
    ON CONFLICT (user_id) DO UPDATE SET
      profile_vec = v_item_vec,
      updated_at = now();
    RETURN;
  END IF;

  IF v_curr_vec IS NULL THEN
    UPDATE public.user_profile_vectors
       SET profile_vec = v_item_vec,
           updated_at = now()
     WHERE user_id = p_user_id;
    RETURN;
  END IF;

  -- 3) Incremental weighted average: blend existing vector with shared item
  -- Using 0.1 as learning rate to gradually update user preferences
  UPDATE public.user_profile_vectors
     SET profile_vec = (v_curr_vec * 0.9) + (v_item_vec * 0.1),
         updated_at = now()
   WHERE user_id = p_user_id;
END;
$$;

-- Trigger function to automate vector updates on share events
CREATE OR REPLACE FUNCTION public.on_share_event_update_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only react to share actions with logged-in users
  IF NEW.action = 'share' AND NEW.user_id IS NOT NULL THEN
    PERFORM public.update_user_vector_on_share(NEW.user_id, NEW.drop_id, 3);
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first in case it exists)
DROP TRIGGER IF EXISTS trg_share_update_vector ON public.engagement_events;

CREATE TRIGGER trg_share_update_vector
AFTER INSERT ON public.engagement_events
FOR EACH ROW
EXECUTE FUNCTION public.on_share_event_update_vector();

-- Create index for share events if not exists
CREATE INDEX IF NOT EXISTS idx_engagement_share 
ON public.engagement_events (action, created_at DESC) 
WHERE action = 'share';