import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';

interface OnboardingState {
  current_step: number;
  profile_data: {
    first_name?: string;
    last_name?: string;
    company_role?: string;
    language_prefs?: string[];
    youtube_embed_pref?: boolean;
  };
  selected_topics: number[];
  communication_prefs: { [key: string]: boolean };
}

interface UseOnboardingStateReturn {
  state: OnboardingState;
  isLoading: boolean;
  isAutoSaving: boolean;
  saveStep: (step: number, data: Partial<OnboardingState>) => Promise<void>;
  clearState: () => Promise<void>;
  error: string | null;
}

export function useOnboardingState(): UseOnboardingStateReturn {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    current_step: 1,
    profile_data: {
      language_prefs: ['en'],
      youtube_embed_pref: true,
    },
    selected_topics: [],
    communication_prefs: { newsletter: true },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionStartTime = useRef<number>(Date.now());

  // Auto-save debounce timer
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load existing onboarding state on mount
  useEffect(() => {
    const loadState = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('onboarding_state')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // Error other than "not found"
          console.error('Error loading onboarding state:', error);
          setError(error.message);
        } else if (data) {
          // Found existing state, restore it
          setState({
            current_step: data.current_step,
            profile_data: {
              first_name: (data.profile_data as any)?.first_name || '',
              last_name: (data.profile_data as any)?.last_name || '',
              company_role: (data.profile_data as any)?.company_role || '',
              language_prefs: (data.profile_data as any)?.language_prefs || ['en'],
              youtube_embed_pref: (data.profile_data as any)?.youtube_embed_pref ?? true,
            },
            selected_topics: data.selected_topics || [],
            communication_prefs: (data.communication_prefs as any) || { newsletter: true },
          });

          // Track recovery
          track('onboarding_recovery', {
            step: data.current_step,
            has_profile_data: Object.keys(data.profile_data || {}).length > 0,
            has_topics: (data.selected_topics || []).length > 0,
          });

          toast({
            title: "Welcome back!",
            description: `We've restored your progress from step ${data.current_step}.`,
          });
        }
      } catch (err) {
        console.error('Unexpected error loading onboarding state:', err);
        setError('Failed to load previous progress');
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [user?.id]);

  // Debounced auto-save function
  const debouncedSave = useCallback(
    async (stepData: Partial<OnboardingState>) => {
      if (!user?.id) return;

      setIsAutoSaving(true);
      try {
        const { error } = await supabase
          .from('onboarding_state')
          .upsert({
            user_id: user.id,
            current_step: stepData.current_step || state.current_step,
            profile_data: stepData.profile_data || state.profile_data,
            selected_topics: stepData.selected_topics || state.selected_topics,
            communication_prefs: stepData.communication_prefs || state.communication_prefs,
          });

        if (error) {
          console.error('Error auto-saving onboarding state:', error);
          setError('Failed to save progress automatically');
        } else {
          setError(null); // Clear any previous errors
        }
      } catch (err) {
        console.error('Unexpected error during auto-save:', err);
        setError('Failed to save progress');
      } finally {
        setIsAutoSaving(false);
      }
    },
    [user?.id, state]
  );

  // Manual save step function
  const saveStep = useCallback(
    async (step: number, data: Partial<OnboardingState>) => {
      const newState = {
        ...state,
        current_step: step,
        ...data,
      };

      setState(newState);

      // Clear existing timer and set new one
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }

      // Auto-save after 1 second of inactivity
      autoSaveTimer.current = setTimeout(() => {
        debouncedSave(newState);
      }, 1000);

      // Track step progress
      track('onboarding_step_saved', {
        step,
        auto_save: true,
        data_keys: Object.keys(data),
      });
    },
    [state, debouncedSave]
  );

  // Clear state (for restart)
  const clearState = useCallback(async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('onboarding_state')
        .delete()
        .eq('user_id', user.id);

      setState({
        current_step: 1,
        profile_data: {
          language_prefs: ['en'],
          youtube_embed_pref: true,
        },
        selected_topics: [],
        communication_prefs: { newsletter: true },
      });

      track('onboarding_state_cleared', {});
    } catch (err) {
      console.error('Error clearing onboarding state:', err);
      setError('Failed to restart onboarding');
    }
  }, [user?.id]);

  // Track abandonment when user leaves
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user?.id && state.current_step < 5) {
        const sessionDuration = Math.floor((Date.now() - sessionStartTime.current) / 1000);
        
        try {
          await supabase
            .from('onboarding_abandonment_events')
            .insert({
              user_id: user.id,
              step: state.current_step,
              reason: 'page_unload',
              session_duration_seconds: sessionDuration,
              user_agent: navigator.userAgent,
            });
        } catch (err) {
          console.error('Error tracking abandonment:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id, state.current_step]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  return {
    state,
    isLoading,
    isAutoSaving,
    saveStep,
    clearState,
    error,
  };
}