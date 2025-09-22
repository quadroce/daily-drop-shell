import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type OnboardingData = {
  current_step: number;
  selected_topics: number[];
  profile_data: any;
  communication_prefs: any;
};

type State = {
  current_step: number;
  selected_topics: number[];
  profile_data: any;
  communication_prefs: any;
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
    current_step: 1,
    selected_topics: [],
    profile_data: {},
    communication_prefs: {},
    loaded: false,
    dirty: false,
  });

  // refs per evitare loop
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const lastSavedHashRef = useRef<string>("");
  const lastSnapshotRef = useRef<State | null>(null);
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
        .select("current_step,selected_topics,profile_data,communication_prefs")
        .eq("user_id", user.id)
        .single();

      if (!alive) return;

      if (!error && data) {
        const newState: State = {
          current_step: data.current_step ?? 1,
          selected_topics: data.selected_topics ?? [],
          profile_data: data.profile_data ?? {},
          communication_prefs: data.communication_prefs ?? {},
          loaded: true,
          dirty: false,
        };
        
        lastSnapshotRef.current = newState;
        lastSavedHashRef.current = jsonHash(newState);

        setState(newState);
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
    setState((prev) => 
      prev.current_step === next ? prev : { ...prev, current_step: next, dirty: true }
    );
  }, []);

  const updateData = useCallback((patch: Partial<Omit<State, 'loaded' | 'dirty'>>) => {
    setState((prev) => {
      const nextState = { ...prev, ...patch };
      // se identico, non sporcare
      if (jsonHash(nextState) === jsonHash(prev)) return prev;
      return { ...nextState, dirty: true };
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

        const currentHash = jsonHash(state);
        if (currentHash === lastSavedHashRef.current) {
          setState((p) => ({ ...p, dirty: false }));
          return;
        }

        // persisti
        const { error } = await supabase.from("onboarding_state").upsert({
          user_id: userId,
          current_step: state.current_step,
          selected_topics: state.selected_topics,
          profile_data: state.profile_data,
          communication_prefs: state.communication_prefs,
        });
        if (error) throw error;

        lastSnapshotRef.current = { ...state };
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
            `${state.current_step}`,
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
  }, [state.current_step, state.selected_topics, state.profile_data, state.communication_prefs, state.loaded, state.dirty]);

  // ===== COMPLETE: salva finale e vai a /feed =====
  const completeOnboarding = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // assicurati ultimo save
    const currentHash = jsonHash(state);
    if (currentHash !== lastSavedHashRef.current && !savingRef.current) {
      await supabase.from("onboarding_state").upsert({
        user_id: userId,
        current_step: state.current_step,
        selected_topics: state.selected_topics,
        profile_data: state.profile_data,
        communication_prefs: state.communication_prefs,
      });
      lastSavedHashRef.current = currentHash;
    }

    // flag profilo + redirect
    await supabase.from("profiles").update({ onboarding_completed: true }).eq(
      "id",
      userId,
    );
    navigate("/feed", { replace: true });
  }, [navigate, state]);

  // helper memorizzati
  const api = useMemo(
    () => ({ state, setStep, updateData, completeOnboarding }),
    [state, setStep, updateData, completeOnboarding],
  );

  return api;
}
