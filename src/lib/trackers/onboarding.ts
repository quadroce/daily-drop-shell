import { track } from '@/lib/analytics';

export const trackOnboardingStart = () => {
  track('onboarding_start', { step: 'start' });
};

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