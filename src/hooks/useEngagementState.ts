import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';

type EngagementState = {
  isLiked: boolean;
  isSaved: boolean;
  isDisliked: boolean;
  isDismissed: boolean;
};

type EngagementStates = Record<string, EngagementState>;

export function useEngagementState() {
  const [states, setStates] = useState<EngagementStates>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Initialize states for visible drops
  const initializeStates = useCallback(async (dropIds: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Batch fetch engagement events for all drops
      const { data: engagements } = await supabase
        .from('engagement_events')
        .select('drop_id, action')
        .eq('user_id', user.id)
        .in('drop_id', dropIds.map(id => parseInt(id)));

      // Batch fetch bookmarks
      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('drop_id')
        .eq('user_id', user.id)
        .in('drop_id', dropIds.map(id => parseInt(id)));

      const newStates: EngagementStates = {};
      
      dropIds.forEach(dropId => {
        const dropEngagements = engagements?.filter(e => e.drop_id.toString() === dropId) || [];
        const isBookmarked = bookmarks?.some(b => b.drop_id.toString() === dropId) || false;
        
        newStates[dropId] = {
          isLiked: dropEngagements.some(e => e.action === 'like'),
          isSaved: isBookmarked,
          isDisliked: dropEngagements.some(e => e.action === 'dislike'),
          isDismissed: dropEngagements.some(e => e.action === 'dismiss'),
        };
      });

      setStates(prev => ({ ...prev, ...newStates }));
    } catch (error) {
      console.error('Error initializing engagement states:', error);
    }
  }, []);

  const updateEngagement = useCallback(async (
    dropId: string, 
    action: 'like' | 'dislike' | 'save' | 'dismiss'
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Please sign in to perform this action",
        variant: "destructive",
      });
      return false;
    }

    const currentState = states[dropId] || {
      isLiked: false,
      isSaved: false,
      isDisliked: false,
      isDismissed: false,
    };

    // Calculate new state based on action and mutual exclusivity rules
    let newState = { ...currentState };
    
    switch (action) {
      case 'like':
        newState.isLiked = !currentState.isLiked;
        if (newState.isLiked) {
          newState.isDisliked = false; // Remove dislike when liking
          newState.isSaved = true; // Auto-save on like
        }
        break;
      case 'dislike':
        newState.isDisliked = !currentState.isDisliked;
        if (newState.isDisliked) {
          newState.isLiked = false; // Remove like when disliking
          // Note: Don't remove save when disliking
        }
        break;
      case 'save':
        newState.isSaved = !currentState.isSaved;
        break;
      case 'dismiss':
        newState.isDismissed = !currentState.isDismissed;
        break;
    }

    // Optimistic UI update
    setStates(prev => ({ ...prev, [dropId]: newState }));
    setLoading(prev => ({ ...prev, [dropId]: true }));

    try {
      // Handle engagement events (like, dislike, dismiss)
      if (action !== 'save') {
        const { error: engagementError } = await supabase
          .from('engagement_events')
          .insert({
            user_id: user.id,
            drop_id: parseInt(dropId),
            action,
            channel: 'web',
          });

        // Handle duplicate key errors as success (idempotent)
        if (engagementError && 
            !engagementError.message?.includes('duplicate') && 
            engagementError.code !== '23505') {
          throw engagementError;
        }
      }

      // Handle save/bookmark separately
      if (action === 'save' || (action === 'like' && newState.isSaved && !currentState.isSaved)) {
        if (newState.isSaved) {
          const { error: bookmarkError } = await supabase
            .from('bookmarks')
            .insert({
              user_id: user.id,
              drop_id: parseInt(dropId),
            });

          // Handle duplicate key errors as success
          if (bookmarkError && 
              !bookmarkError.message?.includes('duplicate') && 
              bookmarkError.code !== '23505') {
            throw bookmarkError;
          }
        } else {
          await supabase
            .from('bookmarks')
            .delete()
            .eq('user_id', user.id)
            .eq('drop_id', parseInt(dropId));
        }
      }

      // Fire analytics events
      const isNewState = newState[`is${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof EngagementState];
      
      switch (action) {
        case 'like':
          track('like_click', { drop_id: dropId, new_state: isNewState });
          if (newState.isLiked && !currentState.isSaved) {
            track('auto_save_on_like', { drop_id: dropId });
          }
          break;
        case 'dislike':
          track('dislike_click', { drop_id: dropId, new_state: isNewState });
          break;
        case 'save':
          track('save_click', { drop_id: dropId, new_state: isNewState });
          break;
        case 'dismiss':
          track('dismiss_click', { drop_id: dropId, new_state: isNewState });
          break;
      }

      return true;
    } catch (error) {
      console.error(`Error updating ${action}:`, error);
      
      // Rollback optimistic update
      setStates(prev => ({ ...prev, [dropId]: currentState }));
      
      // Only show toast for real errors
      toast({
        title: `Failed to ${action} item`,
        description: "Please try again",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setLoading(prev => ({ ...prev, [dropId]: false }));
    }
  }, [states]);

  const getState = useCallback((dropId: string): EngagementState => {
    return states[dropId] || {
      isLiked: false,
      isSaved: false,
      isDisliked: false,
      isDismissed: false,
    };
  }, [states]);

  const isLoading = useCallback((dropId: string): boolean => {
    return loading[dropId] || false;
  }, [loading]);

  return {
    initializeStates,
    updateEngagement,
    getState,
    isLoading,
  };
}