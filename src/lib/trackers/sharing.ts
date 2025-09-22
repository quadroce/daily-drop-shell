import { track } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';

export interface ShareTrackingParams {
  dropId: string;
  title: string;
  url: string;
  channel: 'linkedin' | 'reddit' | 'whatsapp' | 'copylink' | 'native';
  userId?: string | null;
}

/**
 * Track share events and update user personalization vectors
 */
export const trackShare = async ({ dropId, title, url, channel, userId }: ShareTrackingParams) => {
  try {
    // Log to engagement_events table (triggers vector update automatically)
    const { error: dbError } = await supabase
      .from('engagement_events')
      .insert([{
        user_id: userId || null,
        drop_id: parseInt(dropId),
        action: 'share',
        channel
      }]);

    if (dbError) {
      console.error('Error logging share to database:', dbError);
    }

    // Track analytics event
    track('share_article_clicked', {
      drop_id: dropId,
      title: title.substring(0, 100), // Truncate for analytics
      url,
      channel,
      has_user: !!userId,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error in trackShare:', error);
    return { success: false, error };
  }
};

/**
 * Generate pre-filled share message with clickable dailydrops.cloud link
 */
export const generateShareMessage = (url: string): string => {
  return `I discovered this article using dailydrops.cloud – Register to find new contents for professionals. ${url}`;
};

/**
 * Share URLs for different platforms
 */
export const getShareUrls = (title: string, url: string, message: string) => {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  
  // Create message with clickable dailydrops.cloud link
  const shareText = `I discovered this article using https://dailydrops.cloud – Register to find new contents for professionals. ${url}`;
  const encodedMessage = encodeURIComponent(shareText);

  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedMessage}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${encodedMessage}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}` // Not used per requirements
  };
};