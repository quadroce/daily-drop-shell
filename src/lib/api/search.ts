import { supabase } from "@/integrations/supabase/client";
import { getYouTubeVideoId } from "@/lib/youtube";
import type { FeedCardProps } from "@/components/FeedCard";

export interface SearchFiltersType {
  source?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchParams extends SearchFiltersType {
  query?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  results: FeedCardProps[];
  total: number;
  page: number;
  hasMore: boolean;
}

export const searchContent = async (params: SearchParams): Promise<SearchResult> => {
  const {
    query,
    source,
    tag,
    dateFrom,
    dateTo,
    page = 1,
    limit = 12
  } = params;

  try {
    // Build the query
    let supabaseQuery = supabase
      .from('drops')
      .select(`
        id,
        title,
        url,
        summary,
        image_url,
        published_at,
        type,
        tags,
        sources:source_id(name, homepage_url)
      `)
      .eq('tag_done', true);

    // Apply text search
    if (query) {
      supabaseQuery = supabaseQuery.or(
        `title.ilike.%${query}%,summary.ilike.%${query}%`
      );
    }

    // Apply source filter  
    if (source) {
      const { data: sourceData } = await supabase
        .from('sources')
        .select('id')
        .ilike('name', `%${source}%`)
        .single();
      
      if (sourceData) {
        supabaseQuery = supabaseQuery.eq('source_id', sourceData.id);
      }
    }

    // Apply tag filter
    if (tag) {
      supabaseQuery = supabaseQuery.contains('tags', [tag]);
    }

    // Apply date filters
    if (dateFrom) {
      supabaseQuery = supabaseQuery.gte('published_at', `${dateFrom}T00:00:00Z`);
    }

    if (dateTo) {
      supabaseQuery = supabaseQuery.lte('published_at', `${dateTo}T23:59:59Z`);
    }

    // Get total count first
    const { count } = await supabase
      .from('drops')
      .select('*', { count: 'exact', head: true })
      .eq('tag_done', true);

    // Apply pagination and ordering
    const offset = (page - 1) * limit;
    supabaseQuery = supabaseQuery
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: drops, error } = await supabaseQuery;

    if (error) {
      console.error('Search error:', error);
      throw error;
    }

    // Transform to FeedCardProps format
    const results: FeedCardProps[] = (drops || []).map(drop => ({
      id: String(drop.id),
      title: drop.title,
      summary: drop.summary || '',
      imageUrl: drop.image_url || '',
      publishedAt: drop.published_at || new Date().toISOString(),
      type: drop.type,
      tags: drop.tags || [],
      source: {
        name: drop.sources?.name || 'Unknown',
        url: drop.sources?.homepage_url || ''
      },
      href: drop.url,
      youtubeId: drop.url.includes('youtube.com') || drop.url.includes('youtu.be') 
        ? getYouTubeVideoId(drop.url) || undefined
        : undefined
    }));

    return {
      results,
      total: count || 0,
      page,
      hasMore: (count || 0) > page * limit
    };

  } catch (error) {
    console.error('Search content error:', error);
    throw error;
  }
};

// Get popular sources for filter dropdown
export const getPopularSources = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('name')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    return data?.map(source => source.name) || [];
  } catch (error) {
    console.error('Get popular sources error:', error);
    return [];
  }
};

// Get popular tags for filter dropdown
export const getPopularTags = async (): Promise<string[]> => {
  try {
    // This is a simplified version - in a real app you might want to 
    // aggregate tags from the database to get the most popular ones
    const { data, error } = await supabase
      .from('drops')
      .select('tags')
      .not('tags', 'is', null)
      .limit(1000);

    if (error) throw error;

    // Extract and count all tags
    const tagCounts: Record<string, number> = {};
    data?.forEach(drop => {
      drop.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Return top tags sorted by frequency
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([tag]) => tag);

  } catch (error) {
    console.error('Get popular tags error:', error);
    return [];
  }
};