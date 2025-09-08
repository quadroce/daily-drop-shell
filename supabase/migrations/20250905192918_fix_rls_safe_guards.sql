-- fix_rls_safe_guards.sql
-- Rende idempotenti e condizionali gli ALTER/CREATE POLICY su tabelle che potrebbero non esistere.

-----------------------------
-- ENABLE RLS (condizionale)
-----------------------------
-- ENABLE RLS (condizionale)
DO LANGUAGE plpgsql $$
BEGIN
  IF to_regclass('public.sources') IS NOT NULL THEN
    ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.drops') IS NOT NULL THEN
    ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.languages') IS NOT NULL THEN
    ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.topics') IS NOT NULL THEN
    ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.corporate_sources') IS NOT NULL THEN
    ALTER TABLE public.corporate_sources ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.daily_batches') IS NOT NULL THEN
    ALTER TABLE public.daily_batches ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.daily_batch_items') IS NOT NULL THEN
    ALTER TABLE public.daily_batch_items ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.ingestion_queue') IS NOT NULL THEN
    ALTER TABLE public.ingestion_queue ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.newsletter_subscriptions') IS NOT NULL THEN
    ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.sponsor_contents') IS NOT NULL THEN
    ALTER TABLE public.sponsor_contents ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.whatsapp_subscriptions') IS NOT NULL THEN
    ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

------------------------------------------
-- POLICIES su tabelle pubblicamente leggibili
------------------------------------------
DO LANGUAGE plpgsql $$
BEGIN
  IF to_regclass('public.languages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "languages_public_read" ON public.languages;
    CREATE POLICY "languages_public_read" ON public.languages
      FOR SELECT USING (true);
  END IF;

  IF to_regclass('public.topics') IS NOT NULL THEN
    DROP POLICY IF EXISTS "topics_public_read" ON public.topics;
    CREATE POLICY "topics_public_read" ON public.topics
      FOR SELECT USING (true);
  END IF;

  IF to_regclass('public.sources') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sources_public_read" ON public.sources;
    CREATE POLICY "sources_public_read" ON public.sources
      FOR SELECT USING (true);
  END IF;

  IF to_regclass('public.drops') IS NOT NULL THEN
    DROP POLICY IF EXISTS "drops_public_read" ON public.drops;
    CREATE POLICY "drops_public_read" ON public.drops
      FOR SELECT USING (true);
  END IF;
END
$$;

------------------------------------------
-- POLICIES su tabelle “user-owned”
-- Nota: USO SIA USING SIA WITH CHECK per evitare INSERT/UPDATE non autorizzati.
------------------------------------------
DO LANGUAGE plpgsql $$
BEGIN
  IF to_regclass('public.newsletter_subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "newsletter_owner" ON public.newsletter_subscriptions;
    CREATE POLICY "newsletter_owner" ON public.newsletter_subscriptions
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF to_regclass('public.whatsapp_subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "whatsapp_owner" ON public.whatsapp_subscriptions;
    CREATE POLICY "whatsapp_owner" ON public.whatsapp_subscriptions
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

------------------------------------------
-- POLICIES su tabelle admin/system
------------------------------------------
DO LANGUAGE plpgsql $$
BEGIN
  -- Nessun accesso per chiunque (blocco totale, anche in INSERT)
  IF to_regclass('public.corporate_sources') IS NOT NULL THEN
    DROP POLICY IF EXISTS "corporate_sources_no_access" ON public.corporate_sources;
    CREATE POLICY "corporate_sources_no_access" ON public.corporate_sources
      USING (false) WITH CHECK (false);
  END IF;

  IF to_regclass('public.ingestion_queue') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ingestion_queue_no_access" ON public.ingestion_queue;
    CREATE POLICY "ingestion_queue_no_access" ON public.ingestion_queue
      USING (false) WITH CHECK (false);
  END IF;

  IF to_regclass('public.sponsor_contents') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sponsor_contents_no_access" ON public.sponsor_contents;
    CREATE POLICY "sponsor_contents_no_access" ON public.sponsor_contents
      USING (false) WITH CHECK (false);
  END IF;

  -- Lettura consentita solo al proprietario del batch
  IF to_regclass('public.daily_batches') IS NOT NULL THEN
    DROP POLICY IF EXISTS "daily_batches_user_read" ON public.daily_batches;
    CREATE POLICY "daily_batches_user_read" ON public.daily_batches
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- Lettura degli item consentita solo se l'utente possiede il batch
  IF to_regclass('public.daily_batch_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "daily_batch_items_user_read" ON public.daily_batch_items;
    CREATE POLICY "daily_batch_items_user_read" ON public.daily_batch_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.daily_batches b
          WHERE b.id = daily_batch_items.batch_id
            AND b.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
