import { supabase } from "@/integrations/supabase/client";

export interface OnboardingReminderStatus {
  attempt_count: number;
  last_sent_at: string | null;
  paused: boolean;
}

/**
 * Get the current user's onboarding reminder status
 */
export async function getOnboardingReminderStatus(): Promise<OnboardingReminderStatus | null> {
  try {
    const { data, error } = await supabase
      .from('onboarding_reminders')
      .select('attempt_count, last_sent_at, paused')
      .single();

    if (error) {
      // If no record exists, return default values
      if (error.code === 'PGRST116') {
        return {
          attempt_count: 0,
          last_sent_at: null,
          paused: false
        };
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching onboarding reminder status:', error);
    throw new Error('Failed to fetch onboarding reminder status');
  }
}

/**
 * Pause or unpause onboarding reminders for the current user
 */
export async function pauseOnboardingReminders(paused: boolean): Promise<void> {
  try {
    const { error } = await supabase.rpc('pause_onboarding_reminders', {
      p_paused: paused
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating onboarding reminder pause status:', error);
    throw new Error('Failed to update onboarding reminder settings');
  }
}

/**
 * Save onboarding step data (for auto-save functionality)
 */
export async function saveOnboardingStep(
  step: number,
  profileData?: any,
  selectedTopics?: number[],
  communicationPrefs?: any
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('onboarding_state')
      .upsert({
        user_id: user.id,
        current_step: step,
        profile_data: profileData || {},
        selected_topics: selectedTopics || [],
        communication_prefs: communicationPrefs || {},
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving onboarding step:', error);
    throw new Error('Failed to save onboarding progress');
  }
}

/**
 * Get saved onboarding state
 */
export async function getOnboardingState(): Promise<{
  current_step: number;
  profile_data: any;
  selected_topics: number[];
  communication_prefs: any;
} | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('onboarding_state')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No saved state found
      }
      throw error;
    }

    return {
      current_step: data.current_step,
      profile_data: data.profile_data,
      selected_topics: data.selected_topics,
      communication_prefs: data.communication_prefs,
    };
  } catch (error) {
    console.error('Error fetching onboarding state:', error);
    throw new Error('Failed to fetch onboarding state');
  }
}

/**
 * Clear saved onboarding state (after completion)
 */
export async function clearOnboardingState(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('onboarding_state')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error clearing onboarding state:', error);
    throw new Error('Failed to clear onboarding state');
  }
}

/**
 * Track onboarding abandonment
 */
export async function trackOnboardingAbandonment(
  step: number,
  reason: string,
  sessionDurationSeconds?: number
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return; // Don't throw, just skip tracking
    }

    const { error } = await supabase
      .from('onboarding_abandonment_events')
      .insert({
        user_id: user.id,
        step,
        reason,
        session_duration_seconds: sessionDurationSeconds,
        user_agent: navigator.userAgent,
      });

    if (error) {
      console.error('Error tracking abandonment:', error);
      // Don't throw - tracking failures shouldn't break the app
    }
  } catch (error) {
    console.error('Error tracking onboarding abandonment:', error);
    // Don't throw - tracking failures shouldn't break the app
  }
}