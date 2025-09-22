import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type OnboardingData = {
  languages: string[];
  topicIds: number[];
  youtubeEmbedPref: boolean;
};

type State = {
  step: number;
  data: OnboardingData;
  loaded: boolean;
  dirty: boolean;
};

function jsonHash(obj: unknown) {
  // semplice hash stabile: stringify
  return JSON.stringify(obj);
}

export function useOnboardingState() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({
    step: 1,
    data: { languages: [], topicIds: [], youtubeEmbedPref: true },
    loaded: false,
    dirty: false,
  });

  // refs per evitare loop
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const lastSavedHashRef = useRef<string>("");
  const lastSnapshotRef = useRef<{ step: number; data: OnboardingData } | null>(
    null,
  );
  const mountedRef = useRef(false);

  // ===== LOAD una volta =====
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setState((p) => ({ ...p, loaded: true }));
        return;
      }
      const { data, error } = await supabase
        .from("onboarding_state")
        .select("step,languages,topic_ids,youtube_embed_pref")
        .eq("user_id", user.id)
        .single();

      if (!alive) return;

      if (!error && data) {
        const incoming: OnboardingData = {
          languages: data.languages ?? [],
          topicIds: data.topic_ids ?? [],
          youtubeEmbedPref: !!data.youtube_embed_pref,
        };
        const step = data.step ?? 1;
        const snapshot = { step, data: incoming };
        lastSnapshotRef.current = snapshot;
        lastSavedHashRef.current = jsonHash(snapshot);

        setState({
          step,
          data: incoming,
          loaded: true,
          dirty: false,
        });
      } else {
        // nessuno stato salvato → loaded true ma dirty false
        setState((p) => ({ ...p, loaded: true, dirty: false }));
      }
      mountedRef.current = true;
    })();
    return () => {
      alive = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ===== setters STABILI =====
  const setStep = useCallback((next: number) => {
    setState((
      prev,
    ) => (prev.step === next ? prev : { ...prev, step: next, dirty: true }));
  }, []);

  const updateData = useCallback((patch: Partial<OnboardingData>) => {
    setState((prev) => {
      const nextData = { ...prev.data, ...patch };
      // se identico, non sporcare
      if (jsonHash(nextData) === jsonHash(prev.data)) return prev;
      return { ...prev, data: nextData, dirty: true };
    });
  }, []);

  // ===== AUTOSAVE debounced con guardie anti-loop =====
  useEffect(() => {
    if (!state.loaded) return;
    if (!state.dirty) return;
    if (savingRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      savingRef.current = true;
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u?.user?.id;
        if (!userId) {
          console.warn("Autosave skipped: no user");
          setState((p) => ({ ...p, dirty: false }));
          return;
        }

        const snapshot = { step: state.step, data: state.data };
        // evita risalvataggi identici
        const currentHash = jsonHash(snapshot);
        if (currentHash === lastSavedHashRef.current) {
          setState((p) => ({ ...p, dirty: false }));
          return;
        }

        // persisti
        const { error } = await supabase.from("onboarding_state").upsert({
          user_id: userId,
          step: state.step,
          languages: state.data.languages,
          topic_ids: state.data.topicIds,
          youtube_embed_pref: state.data.youtubeEmbedPref,
        });
        if (error) throw error;

        lastSnapshotRef.current = snapshot;
        lastSavedHashRef.current = currentHash;
        // segna clean SENZA triggherare altri effetti (dirty false fa early-return)
        setState((p) => ({ ...p, dirty: false }));

        // analytics fire-and-forget (non tocca lo stato)
        try {
          // @ts-ignore optional analytics
          window?.ga?.(
            "send",
            "event",
            "onboarding_step_saved",
            `${state.step}`,
          );
          // o il tuo wrapper: analytics.track('onboarding_step_saved', {...})
        } catch {}
      } catch (e) {
        console.error("Autosave failed", e);
        // rimani dirty per ritentare, ma non ciclare
      } finally {
        savingRef.current = false;
      }
    }, 500); // debounce 0.5s
  }, [state.step, state.data, state.loaded, state.dirty]);

  // ===== COMPLETE: salva finale e vai a /feed =====
  const completeOnboarding = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // assicurati ultimo save
    const snapshot = { step: state.step, data: state.data };
    const currentHash = jsonHash(snapshot);
    if (currentHash !== lastSavedHashRef.current && !savingRef.current) {
      await supabase.from("onboarding_state").upsert({
        user_id: userId,
        step: state.step,
        languages: state.data.languages,
        topic_ids: state.data.topicIds,
        youtube_embed_pref: state.data.youtubeEmbedPref,
      });
      lastSavedHashRef.current = currentHash;
    }

    // flag profilo + redirect
    await supabase.from("profiles").update({ onboarding_completed: true }).eq(
      "id",
      userId,
    );
    navigate("/feed", { replace: true });
  }, [navigate, state.step, state.data]);

  // helper memorizzati
  const api = useMemo(
    () => ({ state, setStep, updateData, completeOnboarding }),
    [state, setStep, updateData, completeOnboarding],
  );

  return api;
}
