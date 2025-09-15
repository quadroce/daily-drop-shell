import { track } from '@/lib/analytics';

// Subscription Events
export const trackSubscriptionUpgrade = (planName: string, price?: number) => {
  track('subscription_upgrade', { plan_name: planName, price });
};

export const trackSubscriptionCancel = (planName: string) => {
  track('subscription_cancel', { plan_name: planName });
};

export const trackBeginCheckout = (planName: string) => {
  track('begin_checkout', { plan_name: planName });
};

export const trackPurchase = (planName: string, amount: number) => {
  track('purchase', { plan_name: planName, amount });
};

// Channel Events  
export const trackNewsletterSubscribed = (slot?: string) => {
  track('newsletter_subscribed', { slot });
};

export const trackWhatsappVerified = () => {
  track('whatsapp_verified', {});
};

export const trackWhatsappDropSent = (slot?: string, status: 'sent' | 'failed' = 'sent') => {
  track('whatsapp_drop_sent', { slot, status });
};

// Legacy events (keep for compatibility)
export const trackSubscriptionDowngrade = (fromPlan: string, toPlan: string) => {
  track('subscription_downgrade', { from_plan: fromPlan, to_plan: toPlan });
};