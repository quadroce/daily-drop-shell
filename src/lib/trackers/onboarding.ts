import { track } from '@/lib/analytics';

// Track subscription tier as user property
export const setUserTier = (subscriptionTier: string) => {
  track('set_user_property', { 
    subscription_tier: subscriptionTier 
  });
};

// Onboarding Events
export const trackOnboardingStart = () => {
  track('onboarding_start', { step: 'start' });
};

export const trackOnboardingProfileSubmitted = (rolePresent: boolean) => {
  track('onboarding_profile_submitted', { role_present: rolePresent });
};

export const trackOnboardingLanguagesSet = (count: number, languages: string[]) => {
  track('onboarding_languages_set', { count, languages });
};

export const trackOnboardingEmbedPrefSet = (youtubeEmbedPref: boolean) => {
  track('onboarding_embed_pref_set', { youtube_embed_pref: youtubeEmbedPref });
};

export const trackOnboardingTopicsConfirmed = (l1: number, l2: number, l3: number, total: number) => {
  track('onboarding_topics_confirmed', { l1, l2, l3, total });
};

export const trackOnboardingCompleted = (totalTopics: number) => {
  track('onboarding_completed', { total_topics: totalTopics });
};

// Auth Events
export const trackSignupComplete = (method: 'email' | 'google' | 'linkedin') => {
  track('signup_complete', { method });
};

// Legacy events (keep for compatibility)
export const trackPreferencesCompleted = (topicsCount: number, languagesCount: number = 1) => {
  track('preferences_completed', { 
    topics_count: topicsCount, 
    languages_count: languagesCount 
  });
};

export const trackOnboardingDone = () => {
  track('onboarding_done', {});
};

export const trackSignupClick = (source?: string) => {
  track('signup_click', { source: source || 'unknown' });
};

export const trackUpgradeClick = (source?: string, plan?: string) => {
  track('upgrade_click', { 
    source: source || 'unknown', 
    plan: plan || 'premium' 
  });
};