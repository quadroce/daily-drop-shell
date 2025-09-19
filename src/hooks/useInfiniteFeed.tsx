import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

export type FeedItem = {
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
  type: string;
};

async function fetchPage({
  userId,
  cursor,
  language,
  l1,
  l2,
  limit = 30
}: {
  userId: string;
  cursor: string | null;
  language?: string | null;
  l1?: number | null;
  l2?: number | null;
  limit?: number;
}): Promise<{ items: FeedItem[], nextCursor: string | null }> {
  const { data, error } = await supabase.rpc('feed_get_page_drops', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor: cursor,
    p_language: language ?? null,
    p_l1: l1 ?? null,
    p_l2: l2 ?? null
  });
  
  if (error) throw error;

  const items = (data ?? []) as FeedItem[];
  const last = items.at(-1);
  const nextCursor = last
    ? btoa(`${last.final_score}:${last.published_at}:${last.id}`)
    : null;
  
  return { items, nextCursor };
}

export function useInfiniteFeed({ 
  user, 
  language, 
  l1, 
  l2 
}: { 
  user: any;
  language?: string | null;
  l1?: number | null;
  l2?: number | null;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    if (loading || !hasMore || !user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { items: page, nextCursor } = await fetchPage({
        userId: user.id,
        cursor,
        language,
        l1,
        l2,
        limit: 30
      });
      
      setItems(prev => {
        const seen = new Set(prev.map(i => i.id));
        return prev.concat(page.filter(i => !seen.has(i.id)));
      });
      
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor) && page.length > 0);
      
      // Track analytics
      if (cursor === null) {
        track('feed_loaded', { count: page.length });
      } else {
        track('feed_load_more', { count: page.length });
      }
    } catch (e: any) {
      const errorMessage = e?.message ?? 'Unknown error';
      setError(errorMessage);
      track('feed_error', { message: errorMessage });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [loading, hasMore, user?.id, cursor, language, l1, l2]);

  // Reset when filters change
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
    setInitialLoading(true);
  }, [user?.id, language, l1, l2]);

  // Initial load
  useEffect(() => {
    if (user?.id && items.length === 0 && !loading) {
      load();
    }
  }, [user?.id, items.length, loading, load]);

  const retry = useCallback(() => {
    setError(null);
    load();
  }, [load]);

  return { 
    items, 
    load, 
    loading, 
    hasMore, 
    error, 
    retry, 
    initialLoading 
  };
}