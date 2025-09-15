import { track } from '@/lib/analytics';

/**
 * Newsletter channel tracking
 */
export const trackNewsletterSubscribed = (slot?: string) => {
  track('newsletter_subscribed', { slot });
};

export const trackNewsletterUnsubscribed = (slot?: string) => {
  track('newsletter_unsubscribed', { slot });
};

/**
 * WhatsApp channel tracking  
 */
export const trackWhatsappVerified = () => {
  track('whatsapp_verified', {});
};

export const trackWhatsappDropSent = (slot?: string, status: 'sent' | 'failed' = 'sent') => {
  track('whatsapp_drop_sent', { slot, status });
};

export const trackWhatsappSubscribed = (slots?: string[]) => {
  track('whatsapp_subscribed', { slots });
};

export const trackWhatsappUnsubscribed = () => {
  track('whatsapp_unsubscribed', {});
};