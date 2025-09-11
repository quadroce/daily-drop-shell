import { useCallback } from 'react';

export const isProd = import.meta.env.PROD;

declare global {
  interface Window { 
    dataLayer?: any[]; 
    gtag?: (...args: any[]) => void; 
  }
}

export type AnalyticsEvent = 
  | 'page_view'
  | 'save_item'
  | 'dismiss_item' 
  | 'like_item'
  | 'dislike_item'
  | 'open_item'
  | 'video_play'
  | 'video_progress'
  | 'video_complete'
  | 'signup_click'
  | 'upgrade_click'
  | 'search_performed'
  | 'filters_applied'
  | 'search_result_engaged'
  | 'onboarding_start'
  | 'preferences_completed'
  | 'onboarding_done'
  | 'view_pricing'
  | 'begin_checkout'
  | 'subscription_upgrade'
  | 'scroll_50'
  | 'scroll_90'
  | 'dwell_time'
  | 'dwell_time_total';

export type AnalyticsParams = {
  [key: string]: string | number | boolean;
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
  if (!isProd) return;
  ensureGA();
  window.gtag!('event', event, params);
}

export function identify(userId?: string) {
  if (!isProd || !userId) return;
  ensureGA();
  window.gtag!('config', 'G-1S2C81YQGW', { user_id: userId, send_page_view: false });
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