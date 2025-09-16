import { supabase } from '@/integrations/supabase/client';

type FeedbackAction = 'open' | 'like' | 'dislike' | 'save' | 'dismiss';

// Track if we've already scheduled a profile refresh in this session
let profileRefreshScheduled = false;

/**
 * Send user feedback to the engagement_events table
 */
export async function sendFeedback(action: FeedbackAction, dropId: number, channel: string = 'web') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('User not authenticated, skipping feedback');
      return false;
    }

    const { error } = await supabase
      .from('engagement_events')
      .insert({
        user_id: user.id,
        drop_id: dropId,
        action,
        channel
      });

    if (error) {
      // If it's a unique constraint violation, it's not a real error
      if (error.code === '23505') {
        console.log(`Feedback ${action} already recorded for drop ${dropId}`);
        return true;
      }
      
      console.error('Error sending feedback:', error);
      return false;
    }

    console.log(`Feedback sent: ${action} for drop ${dropId}`);
    return true;
  } catch (error) {
    console.error('Unexpected error sending feedback:', error);
    return false;
  }
}

/**
 * Schedule a profile refresh (only once per session for feedback actions)
 */
export async function scheduleProfileRefresh() {
  if (profileRefreshScheduled) {
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('User not authenticated, skipping profile refresh');
      return;
    }

    profileRefreshScheduled = true;

    // Call the refresh-user-profile edge function
    const { error } = await supabase.functions.invoke('refresh-user-profile', {
      body: { user_id: user.id }
    });

    if (error) {
      console.error('Error refreshing user profile:', error);
      profileRefreshScheduled = false; // Reset so we can try again
    } else {
      console.log('User profile refresh scheduled successfully');
    }
  } catch (error) {
    console.error('Unexpected error scheduling profile refresh:', error);
    profileRefreshScheduled = false; // Reset so we can try again
  }
}

/**
 * Send feedback with automatic profile refresh scheduling for relevant actions
 */
export async function sendFeedbackWithRefresh(action: FeedbackAction, dropId: number, channel: string = 'web') {
  const success = await sendFeedback(action, dropId, channel);
  
  if (success && ['like', 'save', 'dislike', 'dismiss'].includes(action)) {
    // Schedule profile refresh for actions that affect user preferences
    await scheduleProfileRefresh();
  }
  
  return success;
}

/**
 * Hook for using feedback with toast notifications
 */
export function useFeedback() {
  const sendFeedbackWithToast = async (action: FeedbackAction, dropId: number, channel: string = 'web') => {
    const success = await sendFeedbackWithRefresh(action, dropId, channel);
    
    if (!success) {
      console.error('Failed to record feedback for action:', action, 'dropId:', dropId);
    }
    
    return success;
  };

  return { sendFeedback: sendFeedbackWithToast };
}

/**
 * Debounced function for tracking 'open' actions (e.g., dwell time)
 */
export function createDebouncedOpenTracker(delay: number = 2000) {
  let timeoutId: NodeJS.Timeout | null = null;
  let trackedDrops = new Set<number>();

  return (dropId: number) => {
    // Don't track the same drop multiple times
    if (trackedDrops.has(dropId)) {
      return;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      trackedDrops.add(dropId);
      sendFeedback('open', dropId);
    }, delay);
  };
}