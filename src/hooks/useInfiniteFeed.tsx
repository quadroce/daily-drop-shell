import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeedItem {
  id: number;
  title: string;
  url: string;
  source_id: number | null;
  image_url: string | null;
  summary: string | null;
  published_at: string;
  language: string | null;
  tags: string[] | null;
  l1_topic_id: number | null;
  l2_topic_id: number | null;
  final_score: number;
  reason_for_ranking: string | null;
  youtube_video_id: string | null;
  youtube_channel_id: string | null;
  youtube_thumbnail_url: string | null;
  source_name: string | null;
  type: 'article' | 'video' | 'other';
}

interface FetchPageParams {
  userId: string;
  cursor: string | null;
  language?: string | null;
  l1?: number | null;
  l2?: number | null;
  limit?: number;
}

async function fetchPage({
  userId,
  cursor,
  language,
  l1,
  l2,
  limit = 30
}: FetchPageParams): Promise<{ items: FeedItem[], nextCursor: string | null }> {
  console.log('🔄 fetchPage called with:', { userId, cursor, language, l1, l2, limit });
  
  try {
    console.log('📡 About to call RPC feed_get_page_drops');
    // Try the RPC first (uses cache or real-time ranking)
    const { data, error } = await supabase.rpc('feed_get_page_drops', {
      p_user_id: userId,
      p_limit: limit,
      p_cursor: cursor || null,
      p_language: language || null,
      p_l1: l1 || null,
      p_l2: l2 || null
    });

    console.log('📡 RPC Response received:', { 
      hasData: !!data, 
      hasError: !!error, 
      dataLength: data?.length,
      errorMessage: error?.message 
    });

    if (error) {
      console.warn('⚠️ RPC failed, trying fallback query:', error);
      throw error;
    }

    const items = (data ?? []) as FeedItem[];
    
    // For RPC: Use position-based pagination
    let nextCursor = null;
    if (items.length >= limit) {
      // Parse current position from cursor, or start at 1
      const currentPosition = cursor ? 
        (JSON.parse(cursor).position || 1) : 1;
      const nextPosition = currentPosition + items.length;
      nextCursor = JSON.stringify({ position: nextPosition });
    }
    
    console.log('✅ RPC query successful:', { 
      itemsCount: items.length, 
      limit, 
      nextCursor: !!nextCursor,
      hasMore: !!nextCursor,
      personalizedScores: items.slice(0, 3).map(i => ({ 
        score: i.final_score, 
        reason: i.reason_for_ranking 
      }))
    });
    
    console.log('📤 Returning from fetchPage with RPC result');
    return { items, nextCursor };
    
  } catch (rpcError) {
    console.log('🔄 RPC failed, using fallback query...', {
      error: rpcError instanceof Error ? rpcError.message : 'Unknown error',
      userId,
      cursor,
      language
    });
    
    // Fallback to direct query - include score fields for proper calculation
    let query = supabase
      .from('drops')
      .select(`
        id, title, url, source_id, image_url, summary, published_at,
        language, tags, l1_topic_id, l2_topic_id, type,
        youtube_video_id, youtube_channel_id, youtube_thumbnail_url,
        authority_score, quality_score, popularity_score,
        sources:source_id(name)
      `)
      .eq('tag_done', true)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit + 1); // Get one extra to check if there are more

    // Apply cursor if provided
    if (cursor) {
      try {
        const decoded = atob(cursor);
        const [score, publishedAt, id] = decoded.split(':');
        if (publishedAt && publishedAt !== 'null') {
          query = query.lt('published_at', publishedAt);
        }
      } catch (e) {
        console.warn('Failed to parse cursor, ignoring:', e);
      }
    }

    const { data: fallbackData, error: fallbackError } = await query;
    
    if (fallbackError) {
      console.error('❌ Fallback query failed:', fallbackError);
      throw fallbackError;
    }

    // Transform the data to match expected format
    const allItems = (fallbackData ?? []).map((item: any) => {
      // Calculate proper final_score from available scores
      const authorityScore = Number(item.authority_score) || 0.5;
      const qualityScore = Number(item.quality_score) || 0.5;
      const popularityScore = Number(item.popularity_score) || 0.0;
      
      const finalScore = Number(((authorityScore + qualityScore + popularityScore) / 3).toFixed(3));
      
      // Generate meaningful reason for ranking
      let reason = 'Relevant content';
      if (finalScore > 0.7) {
        reason = `High quality • Score: ${finalScore}`;
      } else if (finalScore > 0.5) {
        reason = `Quality content • Score: ${finalScore}`;
      } else if (finalScore > 0.3) {
        reason = `Good content • Score: ${finalScore}`;
      } else {
        reason = `Fresh content • Score: ${finalScore}`;
      }
      
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        source_id: item.source_id,
        image_url: item.image_url,
        summary: item.summary,
        published_at: item.published_at,
        language: item.language,
        tags: item.tags,
        l1_topic_id: item.l1_topic_id,
        l2_topic_id: item.l2_topic_id,
        type: item.type,
        youtube_video_id: item.youtube_video_id,
        youtube_channel_id: item.youtube_channel_id,
        youtube_thumbnail_url: item.youtube_thumbnail_url,
        source_name: item.sources?.name || 'Unknown',
        final_score: finalScore,
        reason_for_ranking: reason
      };
    }) as FeedItem[];

    // Check if there are more items (we fetched limit + 1)
    const hasMoreItems = allItems.length > limit;
    const items = hasMoreItems ? allItems.slice(0, limit) : allItems;
    
    const last = items.at(-1);
    const nextCursor = (hasMoreItems && last && last.published_at)
      ? btoa(`${last.final_score}:${last.published_at}:${last.id}`)
      : null;
    
    console.log('✅ Fallback query successful:', { 
      totalFetched: allItems.length,
      returnedItems: items.length,
      limit,
      hasMore: hasMoreItems,
      nextCursor: nextCursor?.substring(0, 20) + '...',
      lastItemDate: last?.published_at,
      lastItemScore: last?.final_score,
      allItemsCountVsLimit: `${allItems.length} vs ${limit}`
    });
    console.log('📤 Returning from fetchPage with fallback result');
    return { items, nextCursor };
  }
}

interface UseInfiniteFeedParams {
  userId: string | null;
  languageCodes?: string[] | null;
  l1?: number | null;
  l2?: number | null;
}

export function useInfiniteFeed({ userId, languageCodes, l1, l2 }: UseInfiniteFeedParams) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = async () => {
    console.log('🚀 Starting feed load...', { loading, hasMore, userId, cursor });
    if (loading || !hasMore || !userId) {
      console.log('❌ Load blocked:', { loading, hasMore, userId });
      return;
    }
    
    setLoading(true);
    setError(null);
    console.log('✅ Loading started, setLoading(true) called');

    try {
      console.log('📡 Calling fetchPage with params:', {
        userId,
        cursor,
        language: languageCodes?.[0] || null,
        l1,
        l2,
        limit: 30
      });
      
      const result = await fetchPage({
        userId,
        cursor,
        language: languageCodes?.[0] || null, // Use first language for now
        l1,
        l2,
        limit: 30
      });
      
      console.log('📦 Received fetchPage result:', { 
        hasResult: !!result, 
        pageCount: result?.items?.length, 
        nextCursor: result?.nextCursor 
      });

      if (!result) {
        throw new Error('No result returned from fetchPage');
      }

      const { items: page, nextCursor } = result;
      
      console.log('📦 Processed page data:', { pageCount: page.length, nextCursor });

      setItems(prev => {
        console.log('📝 Updating items:', { prevCount: prev.length, newCount: page.length });
        // Deduplicate by id
        const seen = new Set(prev.map(i => i.id));
        const newItems = page.filter(i => !seen.has(i.id));
        const finalItems = [...prev, ...newItems];
        console.log('📝 Final items count:', finalItems.length);
        return finalItems;
      });

      setCursor(nextCursor);
      const newHasMore = Boolean(nextCursor && page.length > 0);
      setHasMore(newHasMore);
      
      console.log('📊 Setting hasMore:', { 
        nextCursor: !!nextCursor, 
        pageLength: page.length, 
        newHasMore,
        cursorValue: nextCursor
      });

      // Analytics tracking
      if (typeof window !== 'undefined' && window.gtag) {
        if (cursor === null) {
          window.gtag('event', 'feed_loaded', { count: page.length });
        } else {
          window.gtag('event', 'feed_load_more', { count: page.length });
        }
      }
      
      console.log('✅ Load completed successfully');
    } catch (e: any) {
      console.error('❌ Error in load function:', e);
      const errorMessage = e.message ?? 'Unknown error loading feed';
      setError(errorMessage);
      
      // Analytics tracking
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'feed_error', { message: errorMessage });
      }
    } finally {
      console.log('🏁 Finally block executing, setLoading(false)');
      setLoading(false);
      setInitialLoading(false);
      console.log('🏁 Finally block completed');
    }
  };

  const reset = () => {
    console.log('🔄 Resetting feed state');
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
    setInitialLoading(true);
    console.log('✅ Feed state reset complete');
  };

  // Initial load and reset on dependency changes
  useEffect(() => {
    console.log('🎯 useInfiniteFeed useEffect triggered:', { userId, languageCodes, l1, l2 });
    if (!userId) {
      console.log('❌ useInfiniteFeed: No userId, skipping load');
      return;
    }
    
    console.log('🔄 useInfiniteFeed: Resetting and loading...');
    reset();
    // Longer delay to ensure state is completely reset
    const timer = setTimeout(() => {
      console.log('🚀 Delayed load triggered');
      load();
    }, 100);

    return () => clearTimeout(timer);
  }, [userId, languageCodes, l1, l2]);

  return { 
    items, 
    load, 
    loading, 
    hasMore, 
    error, 
    initialLoading,
    reset 
  };
}