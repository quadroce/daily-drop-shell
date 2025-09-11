// Utility functions for UTM parameter handling

export const getUtmParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_term: params.get('utm_term') || '',
    utm_content: params.get('utm_content') || ''
  };
};

export const addUtmToUrl = (url: string, source?: string, medium?: string, campaign?: string): string => {
  try {
    const urlObj = new URL(url);
    
    if (source) urlObj.searchParams.set('utm_source', source);
    if (medium) urlObj.searchParams.set('utm_medium', medium);
    if (campaign) urlObj.searchParams.set('utm_campaign', campaign);
    
    return urlObj.toString();
  } catch {
    return url; // Return original URL if parsing fails
  }
};

export const buildNewsletterLink = (baseUrl: string = '#'): string => {
  return addUtmToUrl(baseUrl, 'newsletter', 'email', 'daily_drop');
};

export const buildWhatsAppLink = (baseUrl: string = '#'): string => {
  return addUtmToUrl(baseUrl, 'whatsapp', 'social', 'daily_drop');
};

export const buildTelegramLink = (baseUrl: string = '#'): string => {
  return addUtmToUrl(baseUrl, 'telegram', 'social', 'daily_drop');
};

export const buildDiscordLink = (baseUrl: string = '#'): string => {
  return addUtmToUrl(baseUrl, 'discord', 'social', 'daily_drop');
};