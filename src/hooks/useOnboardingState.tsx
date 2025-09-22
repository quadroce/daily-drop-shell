import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";

const SAVED_TOPICS_KEY = 'dailydrops_saved_topics';

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
  const { refetch: refetchProfile } = useUserProfile();
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
        // Load saved topics from localStorage for non-logged users
        try {
          const savedTopics = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) || '[]');
          setState((p) => ({ 
            ...p, 
            selected_topics: savedTopics,
            loaded: true 
          }));
        } catch (error) {
          console.error('Error loading saved topics:', error);
          setState((p) => ({ ...p, loaded: true }));
        }
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
        
        // Merge with localStorage topics if any
        try {
          const savedTopics = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) || '[]');
          if (savedTopics.length > 0) {
            const mergedTopics = [...new Set([...newState.selected_topics, ...savedTopics])];
            newState.selected_topics = mergedTopics;
            newState.dirty = true; // Mark as dirty to save the merged topics
            
            // Clear localStorage since we're logged in now
            localStorage.removeItem(SAVED_TOPICS_KEY);
          }
        } catch (error) {
          console.error('Error merging saved topics:', error);
        }
        
        lastSnapshotRef.current = newState;
        lastSavedHashRef.current = jsonHash(newState);

        setState(newState);
      } else {
        // No saved state - check for localStorage topics
        try {
          const savedTopics = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) || '[]');
          const newState: State = {
            current_step: 1,
            selected_topics: savedTopics,
            profile_data: {},
            communication_prefs: {},
            loaded: true,
            dirty: savedTopics.length > 0, // Mark dirty if we have topics to save
          };
          
          setState(newState);
          
          // Clear localStorage since we'll save to DB
          if (savedTopics.length > 0) {
            localStorage.removeItem(SAVED_TOPICS_KEY);
          }
        } catch (error) {
          console.error('Error loading saved topics:', error);
          setState((p) => ({ ...p, loaded: true, dirty: false }));
        }
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

    try {
      // assicurati ultimo save
      const currentHash = jsonHash(state);
      if (currentHash !== lastSavedHashRef.current && !savingRef.current) {
        const { error: saveError } = await supabase.from("onboarding_state").upsert({
          user_id: userId,
          current_step: state.current_step,
          selected_topics: state.selected_topics,
          profile_data: state.profile_data,
          communication_prefs: state.communication_prefs,
        });
        if (saveError) throw saveError;
        lastSavedHashRef.current = currentHash;
      }

      // Transfer selected topics to preferences table
      if (state.selected_topics.length > 0) {
        // Get existing preferences or create new one
        const { data: existingPrefs, error: fetchError } = await supabase
          .from('preferences')
          .select('selected_language_ids')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (fetchError) throw fetchError;

        const { error: upsertError } = await supabase
          .from('preferences')
          .upsert({
            user_id: userId,
            selected_topic_ids: state.selected_topics,
            selected_language_ids: existingPrefs?.selected_language_ids || [],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
        
        if (upsertError) throw upsertError;
      }

      // flag profilo + redirect
      const { error: profileError } = await supabase.from("profiles").update({ onboarding_completed: true }).eq(
        "id",
        userId,
      );
      if (profileError) throw profileError;

      // Wait for profile to be updated with polling mechanism
      const maxAttempts = 10;
      const pollInterval = 500; // 500ms
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        try {
          // Refresh profile cache
          await refetchProfile();
          
          // Check if profile is actually updated
          const { data: updatedProfile, error: checkError } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', userId)
            .single();
            
          if (checkError) throw checkError;
          
          if (updatedProfile?.onboarding_completed === true) {
            // Profile is confirmed updated, safe to navigate
            navigate("/feed", { replace: true });
            return;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        } catch (pollError) {
          console.error('Profile polling error:', pollError);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }
      }
      
      // If we reach here, polling failed - navigate anyway as fallback
      console.warn('Profile update polling timed out, navigating anyway');
      navigate("/feed", { replace: true });
      
    } catch (error) {
      console.error('Error in completeOnboarding:', error);
      throw error; // Re-throw for parent component to handle
    }
  }, [navigate, state, refetchProfile]);

  // helper memorizzati
  const api = useMemo(
    () => ({ state, setStep, updateData, completeOnboarding }),
    [state, setStep, updateData, completeOnboarding],
  );

  return api;
}
