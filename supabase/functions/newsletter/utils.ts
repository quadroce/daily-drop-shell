// Newsletter utility functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface FeedItem {
  id: string;
  url: string;
  title_safe: string;
  date_safe: string | null;
  image_url: string | null;
  source_name: string | null;
  tags: string[];
  summary?: string;
  type?: string;
  final_score?: number;
  reason_for_ranking?: string;
}

export interface TransformedItem extends FeedItem {
  title: string;
  showDate: boolean;
  date: Date | null;
  image: string | null;
}

export interface NewsletterOptions {
  maxItems?: number;
  maxAgeDays?: number;
  maxPerSource?: number;
  useCacheOnly?: boolean;
}

// Environment configuration
export const getNewsletterConfig = () => ({
  maxAgeDays: parseInt(Deno.env.get('NEWSLETTER_MAX_AGE_DAYS') || '30'),
  cacheOnly: Deno.env.get('NEWSLETTER_CACHE_ONLY') === 'true',
  maxPerSource: parseInt(Deno.env.get('NEWSLETTER_MAX_PER_SOURCE') || '2'),
});

// Add or preserve UTM parameters safely
export function addOrPreserveUtm(url: string, utmParams: Record<string, string>): string {
  try {
    const urlObj = new URL(url);
    
    // Add UTM parameters, preserving existing ones
    Object.entries(utmParams).forEach(([key, value]) => {
      if (!urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, value);
      }
    });
    
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

// Generate YouTube thumbnail from URL
export function youtubeThumb(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a YouTube URL
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
    
    // Check for youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1); // Remove leading slash
      if (videoId) {
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Default UTM parameters for newsletter links
export function defaultUtm(): Record<string, string> {
  return {
    utm_source: 'newsletter',
    utm_medium: 'email',
    utm_campaign: 'daily_drop',
  };
}

// Safe item transformation with fallbacks
export function safeItemTransform(item: FeedItem): TransformedItem {
  try {
    const url = new URL(item.url);
    
    // Safe title with fallbacks
    const title = item.title_safe?.trim() || 
                 url.hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '') || 
                 'Untitled Article';
    
    // Safe date handling
    const date = item.date_safe ? new Date(item.date_safe) : null;
    const showDate = !!(date && !isNaN(date.valueOf()));
    
    // Safe image with YouTube fallback
    const image = item.image_url?.trim() || 
                 youtubeThumb(item.url) || 
                 null;
    
    // Add UTM parameters
    const urlWithUtm = addOrPreserveUtm(item.url, defaultUtm());
    
    return {
      ...item,
      url: urlWithUtm,
      title,
      showDate,
      date,
      image,
    };
  } catch (error) {
    console.error('Error transforming item:', error, item);
    
    // Return safe fallback
    return {
      ...item,
      title: 'Article',
      showDate: false,
      date: null,
      image: null,
      url: item.url,
    };
  }
}

// Enforce source diversity
export function enforceDiversity(items: FeedItem[], maxPerSource: number): FeedItem[] {
  const sourceCount: Record<string, number> = {};
  const filtered: FeedItem[] = [];
  
  for (const item of items) {
    const sourceName = item.source_name || 'Unknown';
    const currentCount = sourceCount[sourceName] || 0;
    
    if (currentCount < maxPerSource) {
      filtered.push(item);
      sourceCount[sourceName] = currentCount + 1;
    }
  }
  
  return filtered;
}

// Get user preferences
export async function getUserPrefs(userId: string, supabase: any) {
  try {
    const { data: user } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, subscription_tier')
      .eq('id', userId)
      .single();
    
    const { data: preferences } = await supabase
      .from('preferences')
      .select('selected_topic_ids, selected_language_ids')
      .eq('user_id', userId)
      .maybeSingle();

    // Get language codes from language IDs
    let languageCodes: string[] = [];
    if (preferences?.selected_language_ids?.length > 0) {
      const { data: languages } = await supabase
        .from('languages')
        .select('code')
        .in('id', preferences.selected_language_ids);
      
      languageCodes = languages?.map((lang: any) => lang.code) || [];
    }

    // Default to English if no languages selected
    if (languageCodes.length === 0) {
      languageCodes = ['en'];
    }
    
    return {
      user,
      preferences,
      language_prefs: languageCodes, // Keep same interface for compatibility
      selected_topic_ids: preferences?.selected_topic_ids || [],
    };
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return {
      user: null,
      preferences: null,
      language_prefs: ['en'], // Default to English
      selected_topic_ids: [],
    };
  }
}

// Get user feed cache
export async function getUserFeedCache(userId: string, supabase: any, maxAgeHours: number = 24): Promise<FeedItem[]> {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    
    const { data: cachedItems, error } = await supabase
      .from('user_feed_cache')
      .select(`
        final_score, reason_for_ranking, position,
        drops!inner(
          id, url, title, summary, image_url, published_at, created_at, 
          tags, type, sources(name)
        )
      `)
      .eq('user_id', userId)
      .gt('created_at', cutoffTime)
      .order('position', { ascending: true });
    
    if (error || !cachedItems?.length) {
      return [];
    }
    
    return cachedItems.map((item: any) => ({
      id: String(item.drops.id),
      url: item.drops.url,
      title_safe: item.drops.title || '',
      date_safe: item.drops.published_at || item.drops.created_at,
      image_url: item.drops.image_url,
      source_name: item.drops.sources?.name || 'Unknown Source',
      tags: item.drops.tags || [],
      summary: item.drops.summary,
      type: item.drops.type,
      final_score: item.final_score,
      reason_for_ranking: item.reason_for_ranking,
    }));
  } catch (error) {
    console.error('Error fetching user feed cache:', error);
    return [];
  }
}

// Select content directly from drops with filters
export async function selectDirectFromDrops(
  maxAgeDays: number,
  prefs: any,
  supabase: any,
  maxItems: number = 10
): Promise<FeedItem[]> {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from('drops_email_ready')
      .select('*')
      .gte('date_safe', cutoffDate)
      .order('date_safe', { ascending: false });
    
    // Apply language filter if preferences exist
    if (prefs.language_prefs?.length > 0) {
      query = query.in('lang_code', prefs.language_prefs);
    }
    
    // Apply topic filter if preferences exist
    if (prefs.selected_topic_ids?.length > 0) {
      // Get topic slugs
      const { data: topics } = await supabase
        .from('topics')
        .select('slug')
        .in('id', prefs.selected_topic_ids);
      
      const topicSlugs = topics?.map((t: any) => t.slug) || [];
      if (topicSlugs.length > 0) {
        query = query.overlaps('tags', topicSlugs);
      }
    }
    
    const { data: items, error } = await query.limit(maxItems * 2); // Get more for filtering
    
    if (error) {
      console.error('Error fetching drops:', error);
      return [];
    }
    
    return (items || []).map((item: any) => ({
      id: String(item.id),
      url: item.url,
      title_safe: item.title_safe,
      date_safe: item.date_safe,
      image_url: item.image_url,
      source_name: item.source_name,
      tags: item.tags || [],
      summary: item.summary,
      type: item.type,
    }));
  } catch (error) {
    console.error('Error selecting from drops:', error);
    return [];
  }
}

// Generate safe user greeting name from first_name + last_name
// Returns empty string if no names available (no fallback to email/username)
export function getUserGreeting(user: any): string {
  if (!user) return '';
  
  const firstName = user.first_name?.trim();
  const lastName = user.last_name?.trim();
  
  // Build full name from available parts
  const nameParts = [firstName, lastName].filter(Boolean);
  
  // Return joined name or empty string (no fallbacks)
  return nameParts.length > 0 ? nameParts.join(' ') : '';
}