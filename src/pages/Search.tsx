import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { FeedCard } from "@/components/FeedCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search as SearchIcon, Filter } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeVideoId } from "@/lib/youtube";
import type { FeedCardProps } from "@/components/FeedCard";

interface SearchFilters {
  source?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface SearchResult {
  results: FeedCardProps[];
  total: number;
  page: number;
}

const searchContent = async (query: string, filters: SearchFilters, page: number = 1): Promise<SearchResult> => {
  try {
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
        source_id,
        sources!inner(name, homepage_url)
      `)
      .eq('tag_done', true);

    // Apply text search
    if (query) {
      supabaseQuery = supabaseQuery.or(
        `title.ilike.%${query}%,summary.ilike.%${query}%`
      );
    }

    // Apply tag filter
    if (filters.tag) {
      supabaseQuery = supabaseQuery.contains('tags', [filters.tag]);
    }

    // Apply date filters
    if (filters.dateFrom) {
      supabaseQuery = supabaseQuery.gte('published_at', `${filters.dateFrom}T00:00:00Z`);
    }

    if (filters.dateTo) {
      supabaseQuery = supabaseQuery.lte('published_at', `${filters.dateTo}T23:59:59Z`);
    }

    // Get total count
    const { count } = await supabase
      .from('drops')
      .select('*', { count: 'exact', head: true })
      .eq('tag_done', true);

    // Apply pagination
    const limit = 12;
    const offset = (page - 1) * limit;
    supabaseQuery = supabaseQuery
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: drops, error } = await supabaseQuery;

    if (error) throw error;

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
      youtubeId: drop.url && (drop.url.includes('youtube.com') || drop.url.includes('youtu.be'))
        ? getYouTubeVideoId(drop.url) || undefined
        : undefined
    }));

    return {
      results,
      total: count || 0,
      page
    };

  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { track } = useAnalytics();
  
  // Extract URL parameters
  const query = searchParams.get("q") || "";
  const source = searchParams.get("source") || "";
  const tag = searchParams.get("tag") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";
  const page = parseInt(searchParams.get("page") || "1");

  const [currentQuery, setCurrentQuery] = useState(query);
  const [filters, setFilters] = useState<SearchFilters>({
    source,
    tag,
    dateFrom,
    dateTo,
  });

  useEffect(() => {
    track('page_view', { 
      page: 'search',
      query,
      hasFilters: !!(source || tag || dateFrom || dateTo)
    });
  }, [track, query, source, tag, dateFrom, dateTo]);

  // Search API call
  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['search', query, tag, dateFrom, dateTo, page],
    queryFn: () => searchContent(query, filters, page),
    enabled: !!(query || tag || dateFrom || dateTo),
  });

  const updateSearchParams = (newQuery?: string, newFilters?: Partial<SearchFilters>) => {
    const params = new URLSearchParams();
    
    const finalQuery = newQuery !== undefined ? newQuery : query;
    const finalFilters = { ...filters, ...newFilters };
    
    if (finalQuery) params.set("q", finalQuery);
    if (finalFilters.source) params.set("source", finalFilters.source);
    if (finalFilters.tag) params.set("tag", finalFilters.tag);
    if (finalFilters.dateFrom) params.set("date_from", finalFilters.dateFrom);
    if (finalFilters.dateTo) params.set("date_to", finalFilters.dateTo);
    
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams(currentQuery);
    
    track('search_performed', {
      query: currentQuery,
      source,
      tag,
      dateFrom,
      dateTo
    });
  };

  const handleFilterChange = (filterKey: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [filterKey]: value || undefined };
    setFilters(newFilters);
    updateSearchParams(undefined, { [filterKey]: value || undefined });
  };

  const clearFilter = (filterKey: keyof SearchFilters) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    setFilters(newFilters);
    
    const params = new URLSearchParams(searchParams);
    const paramKey = filterKey === 'dateFrom' ? 'date_from' : 
                     filterKey === 'dateTo' ? 'date_to' : 
                     filterKey;
    params.delete(paramKey);
    setSearchParams(params);
  };

  const clearAllFilters = () => {
    setFilters({});
    setCurrentQuery("");
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = query || tag || dateFrom || dateTo;
  const hasResults = searchResults && searchResults.results.length > 0;

  // SEO setup
  const seoTitle = query 
    ? `Search results for "${query}" - DailyDrops`
    : "Advanced Search - DailyDrops";
  
  const seoDescription = query
    ? `Find articles, videos, and content related to "${query}". ${searchResults?.total || 0} results found.`
    : "Search through thousands of AI & ML articles, videos, and resources with advanced filters.";

  const canonical = `${window.location.origin}/search${window.location.search}`;

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonical={canonical}
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
              <SearchIcon className="w-8 h-8" />
              Advanced Search
            </h1>
            <p className="text-muted-foreground">
              Search through thousands of AI & ML articles, videos, and resources
            </p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-4 max-w-2xl mx-auto">
              <Input
                type="text"
                placeholder="Search for articles, videos, topics..."
                value={currentQuery}
                onChange={(e) => setCurrentQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </form>

          {/* Quick Filters */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                value={tag}
                onValueChange={(value) => handleFilterChange('tag', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by tag" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="">All tags</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="ml">Machine Learning</SelectItem>
                  <SelectItem value="deep-learning">Deep Learning</SelectItem>
                  <SelectItem value="nlp">Natural Language Processing</SelectItem>
                  <SelectItem value="computer-vision">Computer Vision</SelectItem>
                  <SelectItem value="robotics">Robotics</SelectItem>
                  <SelectItem value="gpt">GPT</SelectItem>
                  <SelectItem value="llm">Large Language Models</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={source}
                onValueChange={(value) => handleFilterChange('source', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="">All sources</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="arxiv">ArXiv</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="hugging face">Hugging Face</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                
                {query && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Query: "{query}"
                    <button
                      onClick={() => {
                        setCurrentQuery("");
                        updateSearchParams("");
                      }}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                
                {tag && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Tag: {tag}
                    <button
                      onClick={() => clearFilter('tag')}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-xs"
                >
                  Clear all
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {!hasActiveFilters && (
            <div className="bg-muted/30 rounded-2xl p-8 text-center">
              <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Start your search
              </h2>
              <p className="text-muted-foreground mb-4">
                Enter keywords or use filters to find relevant content
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setCurrentQuery("ai");
                  updateSearchParams("ai");
                }}>
                  AI Articles
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  handleFilterChange('tag', 'ml');
                }}>
                  Machine Learning
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  handleFilterChange('tag', 'deep-learning');
                }}>
                  Deep Learning
                </Button>
              </div>
            </div>
          )}

          {isLoading && hasActiveFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 text-center">
              <p className="text-destructive font-medium">
                An error occurred while searching. Please try again.
              </p>
            </div>
          )}

          {searchResults && !isLoading && (
            <>
              {/* Results Header */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} found
                </p>
              </div>

              {/* Results Grid */}
              {hasResults ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {searchResults.results.map(article => (
                    <FeedCard
                      key={article.id}
                      {...article}
                      onEngage={(action) => {
                        track('search_result_engaged', {
                          itemId: action.itemId,
                          query,
                          tag,
                          action: action.action
                        });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-2xl p-8 text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    No results found
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search terms or filters
                  </p>
                  <Button variant="outline" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Search;