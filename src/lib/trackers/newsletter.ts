import { track } from '@/lib/analytics';

/**
 * Newsletter-specific analytics tracking events
 */

export const trackNewsletterSent = (subscriptionTier: string, cadence: string, itemCount: number, isWelcome = false) => {
  track('newsletter_sent', { 
    subscription_tier: subscriptionTier,
    cadence,
    item_count: itemCount,
    is_welcome: isWelcome
  });
};

export const trackNewsletterClick = (subscriptionTier: string, cadence: string, articleTitle?: string) => {
  track('newsletter_click', { 
    subscription_tier: subscriptionTier,
    cadence,
    article_title: articleTitle
  });
};

export const trackNewsletterOpen = (subscriptionTier: string, cadence: string) => {
  track('newsletter_open', { 
    subscription_tier: subscriptionTier,
    cadence
  });
};

// Legacy newsletter subscribed event (keep for compatibility)
export const trackNewsletterSubscribed = (slot?: string) => {
  track('newsletter_subscribed', { slot });
};
