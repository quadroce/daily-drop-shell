// Newsletter payload builder with cache-first logic
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  FeedItem,
  TransformedItem,
  NewsletterOptions,
  getNewsletterConfig,
  safeItemTransform,
  enforceDiversity,
  getUserPrefs,
  getUserFeedCache,
  selectDirectFromDrops,
  getUserGreeting,
} from './utils.ts';

export interface DigestPayload {
  user: {
    name: string;
    email: string;
    subscription_tier: string;
  };
  digest: {
    cadence: string;
    slot: string;
    date: string;
    items: TransformedItem[];
  };
  testMode?: boolean;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  metadata?: {
    algorithmSource: string;
    itemCount: number;
    cacheHit: boolean;
  };
}

export async function buildNewsletterPayload(
  userId: string,
  cadence: 'daily' | 'weekly' | 'monthly' = 'daily',
  slot: 'morning' | 'afternoon' | 'evening' = 'morning',
  options: NewsletterOptions = {}
): Promise<DigestPayload> {
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get configuration
  const config = getNewsletterConfig();
  const {
    maxItems = 5,
    maxAgeDays = config.maxAgeDays,
    maxPerSource = config.maxPerSource,
    useCacheOnly = config.cacheOnly,
  } = options;
  
  console.log(`🔨 Building newsletter payload - userId: ${userId}, cadence: ${cadence}, useCacheOnly: ${useCacheOnly}`);
  
  try {
    // Get user preferences and profile
    const prefs = await getUserPrefs(userId, supabase);
    if (!prefs.user) {
      throw new Error('User not found');
    }
    
    console.log(`👤 User: ${prefs.user.email}, Language prefs: ${prefs.language_prefs.join(', ')}, Topics: ${prefs.selected_topic_ids.length}`);
    
    // Try cache first
    let items: FeedItem[] = [];
    let cacheHit = false;
    let algorithmSource = 'legacy_fallback';
    
    if (!useCacheOnly) {
      console.log('🚀 Checking user_feed_cache for fresh content...');
      const cachedItems = await getUserFeedCache(userId, supabase, 24);
      
      if (cachedItems.length > 0) {
        console.log(`✅ Found ${cachedItems.length} cached items, using cache`);
        items = cachedItems;
        cacheHit = true;
        algorithmSource = 'user_feed_cache';
      }
    }
    
    // Fallback to direct query if no cache or cache-only disabled
    if (items.length === 0) {
      console.log('📊 No cache available, querying drops directly...');
      items = await selectDirectFromDrops(maxAgeDays, prefs, supabase, maxItems * 3);
      algorithmSource = 'direct_query';
      console.log(`📝 Found ${items.length} items from direct query`);
    }
    
    // Apply diversity constraints and limit
    const diverseItems = enforceDiversity(items, maxPerSource);
    const finalItems = diverseItems.slice(0, maxItems);
    
    console.log(`🎯 Final selection: ${finalItems.length} items (after diversity filtering from ${items.length})`);
    
    // Transform items with safe fallbacks
    const transformedItems = finalItems.map(safeItemTransform);
    
    // Generate user greeting
    const userName = getUserGreeting(prefs.user);
    
    // Build payload
    const payload: DigestPayload = {
      user: {
        name: userName,
        email: prefs.user.email,
        subscription_tier: prefs.user.subscription_tier || 'free',
      },
      digest: {
        cadence,
        slot,
        date: new Date().toISOString().split('T')[0],
        items: transformedItems,
      },
      metadata: {
        algorithmSource,
        itemCount: transformedItems.length,
        cacheHit,
      },
    };
    
    console.log(`✅ Newsletter payload built successfully: ${transformedItems.length} items`);
    return payload;
    
  } catch (error) {
    console.error('❌ Error building newsletter payload:', error);
    
    // Return minimal safe payload
    return {
      user: {
        name: 'there',
        email: '',
        subscription_tier: 'free',
      },
      digest: {
        cadence,
        slot,
        date: new Date().toISOString().split('T')[0],
        items: [],
      },
      metadata: {
        algorithmSource: 'error_fallback',
        itemCount: 0,
        cacheHit: false,
      },
    };
  }
}