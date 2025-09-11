import { track } from '@/lib/analytics';

export const trackSubscriptionUpgrade = (plan: string, status: 'success' | 'cancel' | 'failed') => {
  track('subscription_upgrade', { plan, status });
};

export const trackSubscriptionDowngrade = (fromPlan: string, toPlan: string) => {
  track('subscription_downgrade', { from_plan: fromPlan, to_plan: toPlan });
};

export const trackSubscriptionCancel = (plan: string, reason?: string) => {
  track('subscription_cancel', { plan, reason: reason || 'user_initiated' });
};