import { useCallback } from 'react';

export type AnalyticsEvent = 
  | 'page_view'
  | 'save_item'
  | 'dismiss_item' 
  | 'like_item'
  | 'dislike_item'
  | 'open_item'
  | 'video_play'
  | 'signup_click'
  | 'upgrade_click';

export type AnalyticsParams = {
  [key: string]: string | number | boolean;
};

export const useAnalytics = () => {
  const track = useCallback((event: AnalyticsEvent, params?: AnalyticsParams) => {
    // For now, just log to console. Later, integrate with GA4 or other analytics
    console.log(`🔍 Analytics: ${event}`, params);
    
    // Future GA4 integration would look like:
    // if (typeof gtag !== 'undefined') {
    //   gtag('event', event, params);
    // }
  }, []);

  return { track };
};

// Utility to initialize analytics (for future use)
export const initializeAnalytics = () => {
  console.log('📊 Analytics initialized (console logging mode)');
  // Future: Load GA4 script, set up tracking IDs, etc.
};