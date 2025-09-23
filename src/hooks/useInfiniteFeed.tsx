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
  const { data, error } = await supabase.rpc('feed_get_page_drops', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor: cursor,
    p_language: language ?? null,
    p_l1: l1 ?? null,
    p_l2: l2 ?? null
  });

  if (error) {
    console.error('Feed fetch error:', error);
    throw error;
  }

  const items = (data ?? []) as FeedItem[];
  const last = items.at(-1);
  const nextCursor = last
    ? btoa(`${last.final_score}:${last.published_at}:${last.id}`)
    : null;
  
  return { items, nextCursor };
}

interface UseInfiniteFeedParams {
  userId: string | null;
  language?: string | null;
  l1?: number | null;
  l2?: number | null;
}

export function useInfiniteFeed({ userId, language, l1, l2 }: UseInfiniteFeedParams) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = async () => {
    if (loading || !hasMore || !userId) return;
    
    setLoading(true);
    setError(null);

    try {
      const { items: page, nextCursor } = await fetchPage({
        userId,
        cursor,
        language,
        l1,
        l2,
        limit: 30
      });

      setItems(prev => {
        // Deduplicate by id
        const seen = new Set(prev.map(i => i.id));
        const newItems = page.filter(i => !seen.has(i.id));
        return [...prev, ...newItems];
      });

      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor) && page.length > 0);

      // Analytics tracking
      if (typeof window !== 'undefined' && window.gtag) {
        if (cursor === null) {
          window.gtag('event', 'feed_loaded', { count: page.length });
        } else {
          window.gtag('event', 'feed_load_more', { count: page.length });
        }
      }
    } catch (e: any) {
      const errorMessage = e.message ?? 'Unknown error loading feed';
      setError(errorMessage);
      
      // Analytics tracking
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'feed_error', { message: errorMessage });
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const reset = () => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
    setInitialLoading(true);
  };

  // Initial load and reset on dependency changes
  useEffect(() => {
    if (!userId) return;
    
    reset();
    // Small delay to ensure state is reset
    const timer = setTimeout(() => {
      load();
    }, 50);

    return () => clearTimeout(timer);
  }, [userId, language, l1, l2]);

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