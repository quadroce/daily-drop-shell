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