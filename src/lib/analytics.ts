import { useCallback } from 'react';

export const isProd = import.meta.env.PROD;

declare global {
  interface Window { 
    dataLayer?: any[]; 
    gtag?: (...args: any[]) => void; 
  }
}

export type AnalyticsEvent = 
  // Business Conversions
  | 'signup_complete'
  | 'subscription_upgrade'
  | 'subscription_cancel'
  // Onboarding Events
  | 'onboarding_profile_submitted'
  | 'onboarding_languages_set'
  | 'onboarding_embed_pref_set'
  | 'onboarding_topics_confirmed'
  | 'onboarding_completed'
  // Feed & Content Events
  | 'drop_viewed'
  | 'content_click'
  | 'save_item'
  | 'dismiss_item'
  | 'like_item'
  | 'dislike_item'
  // Video Events
  | 'video_play'
  | 'video_pause'
  | 'video_complete'
  // Channel Events
  | 'newsletter_subscribed'
  | 'newsletter_sent'
  | 'newsletter_click'
  | 'newsletter_open'
  | 'whatsapp_verified'
  | 'whatsapp_drop_sent'
  // Monetization Events
  | 'begin_checkout'
  | 'purchase'
  // Legacy Events (keep for compatibility)
  | 'page_view'
  | 'open_item'
  | 'video_progress'
  | 'signup_click'
  | 'upgrade_click'
  | 'search_performed'
  | 'filters_applied'
  | 'search_result_engaged'
  | 'onboarding_start'
  | 'preferences_completed'
  | 'onboarding_done'
  | 'view_pricing'
  | 'scroll_50'
  | 'scroll_90'
  | 'dwell_time'
  | 'dwell_time_total'
  | 'set_user_property';

export type AnalyticsParams = {
  [key: string]: string | number | boolean | string[] | undefined;
};

export function ensureGA() {
  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag) window.gtag = function(){ window.dataLayer!.push(arguments as any); };
}

export function initGA(userId?: string) {
  if (!isProd) return;
  ensureGA();
  if (userId) {
    window.gtag!('config', 'G-1S2C81YQGW', { user_id: userId, send_page_view: false });
  }
}

export function pageview(path: string, title?: string) {
  if (!isProd) return;
  ensureGA();
  window.gtag!('event', 'page_view', {
    page_path: path,
    page_title: title || document.title
  });
}

export function track(event: string, params: Record<string, any> = {}) {
  if (!isProd) {
    console.log(`[Analytics] ${event}`, params);
    return;
  }
  ensureGA();
  window.gtag!('event', event, params);
}

export function identify(userId?: string) {
  if (!isProd || !userId) return;
  ensureGA();
  window.gtag!('config', 'G-1S2C81YQGW', { user_id: userId, send_page_view: false });
}

/**
 * Set user ID for analytics tracking
 */
export function setUserId(userId: string) {
  if (!isProd || !userId) return;
  ensureGA();
  window.gtag!('config', 'G-1S2C81YQGW', { user_id: userId, send_page_view: false });
}

/**
 * Set user properties for analytics
 */
export function setUserProperties(properties: Record<string, any>) {
  if (!isProd) {
    console.log('[Analytics] Set User Properties:', properties);
    return;
  }
  ensureGA();
  
  // Set each property individually as recommended by GA4
  Object.entries(properties).forEach(([key, value]) => {
    window.gtag!('config', 'G-1S2C81YQGW', {
      custom_map: { [key]: value }
    });
  });
  
  // Also track as event for immediate availability
  window.gtag!('event', 'set_user_property', properties);
}

/**
 * Track analytics event with type safety
 */
export function trackEvent(eventName: AnalyticsEvent, params?: AnalyticsParams) {
  track(eventName, params || {});
}

export const useAnalytics = () => {
  const trackEvent = useCallback((event: AnalyticsEvent, params?: AnalyticsParams) => {
    track(event, params);
  }, []);

  return { track: trackEvent };
};

// Utility to initialize analytics
export const initializeAnalytics = () => {
  if (isProd) {
    console.log('📊 Analytics initialized (GA4 mode)');
  } else {
    console.log('📊 Analytics initialized (dev mode - no tracking)');
  }
};