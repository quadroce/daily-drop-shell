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
import { fetchTopicsTree, TopicTreeItem } from "@/lib/api/topics";
import type { FeedCardProps } from "@/components/FeedCard";

interface SearchResult {
  results: FeedCardProps[];
  total: number;
}

const searchContent = async (query: string, tag?: string): Promise<SearchResult> => {
  try {
    // Simple query without complex joins
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
        tags
      `)
      .eq('tag_done', true)
      .order('published_at', { ascending: false })
      .limit(12);

    // Apply text search if provided
    if (query) {
      supabaseQuery = supabaseQuery.or(
        `title.ilike.%${query}%,summary.ilike.%${query}%`
      );
    }

    // Apply tag filter if provided
    if (tag) {
      supabaseQuery = supabaseQuery.contains('tags', [tag]);
    }

    const { data: drops, error, count } = await supabaseQuery;

    if (error) {
      console.error('Search error:', error);
      throw error;
    }

    // Transform to FeedCardProps format (no L1/L2 topics in direct search)
    const results: FeedCardProps[] = (drops || []).map(drop => ({
      id: String(drop.id),
      title: drop.title,
      summary: drop.summary || '',
      imageUrl: drop.image_url || '',
      publishedAt: drop.published_at || new Date().toISOString(),
      type: drop.type,
      tags: drop.tags || [],
      source: {
        name: 'DailyDrops',
        url: '#'
      },
      href: drop.url,
      youtubeId: drop.url && (drop.url.includes('youtube.com') || drop.url.includes('youtu.be'))
        ? getYouTubeVideoId(drop.url) || undefined
        : undefined
    }));

    return {
      results,
      total: drops?.length || 0
    };

  } catch (error) {
    console.error('Search content error:', error);
    return {
      results: [],
      total: 0
    };
  }
};

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { track } = useAnalytics();
  
  // Extract URL parameters
  const query = searchParams.get("q") || "";
  const tag = searchParams.get("tag") || "";

  const [currentQuery, setCurrentQuery] = useState(query);
  const [currentTag, setCurrentTag] = useState(tag);

  // Load topics for filtering
  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['topics-tree'],
    queryFn: fetchTopicsTree,
  });

  // Organize topics by level for display
  const organizeTopics = (topics: TopicTreeItem[]) => {
    const l1Topics = topics.filter(t => t.level === 1);
    const l2Topics = topics.filter(t => t.level === 2);
    const l3Topics = topics.filter(t => t.level === 3);
    
    return { l1Topics, l2Topics, l3Topics };
  };

  const { l1Topics, l2Topics, l3Topics } = organizeTopics(topics);

  useEffect(() => {
    track('page_view', { 
      page: 'search',
      query,
      tag
    });
  }, [track, query, tag]);

  // Search API call
  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['search', query, tag],
    queryFn: () => searchContent(query, tag),
    enabled: !!(query || tag),
  });

  const updateSearchParams = (newQuery?: string, newTag?: string) => {
    const params = new URLSearchParams();
    
    if (newQuery) params.set("q", newQuery);
    if (newTag) params.set("tag", newTag);
    
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentQuery.trim()) {
      updateSearchParams(currentQuery.trim(), currentTag);
      
      track('search_performed', {
        query: currentQuery.trim(),
        tag: currentTag
      });
    }
  };

  const handleTagChange = (value: string) => {
    setCurrentTag(value);
    updateSearchParams(query, value);
  };

  const clearSearch = () => {
    setCurrentQuery("");
    setCurrentTag("");
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = query || tag;
  const hasResults = searchResults && searchResults.results.length > 0;

  // SEO setup
  const seoTitle = query 
    ? `Search results for "${query}" - DailyDrops`
    : "Advanced Search - DailyDrops";
  
  const seoDescription = query
    ? `Find articles, videos, and content related to "${query}". ${searchResults?.total || 0} results found.`
    : "Search through thousands of AI & ML articles, videos, and resources.";

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
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

          {/* Search Form */}
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

          {/* Filters */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter by Topic</span>
            </div>
            
            <div className="max-w-md mx-auto">
              <Select value={currentTag} onValueChange={handleTagChange} disabled={topicsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={topicsLoading ? "Loading topics..." : "Select a topic"} />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {/* Level 1 Topics */}
                  {l1Topics.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Main Categories
                      </div>
                      {l1Topics.map(topic => (
                        <SelectItem 
                          key={topic.id} 
                          value={topic.slug}
                          className="font-medium"
                        >
                          {topic.label}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Level 2 Topics */}
                  {l2Topics.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">
                        Subcategories
                      </div>
                      {l2Topics.map(topic => (
                        <SelectItem 
                          key={topic.id} 
                          value={topic.slug}
                          className="pl-4"
                        >
                          {topic.label}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Level 3 Topics */}
                  {l3Topics.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">
                        Specific Topics
                      </div>
                      {l3Topics.map(topic => (
                        <SelectItem 
                          key={topic.id} 
                          value={topic.slug}
                          className="pl-6 text-sm"
                        >
                          {topic.label}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Loading state */}
                  {topicsLoading && (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      Loading topics...
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {!topicsLoading && topics.length === 0 && (
                    <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                      No topics available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 justify-center">
                <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                
                {query && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Search: "{query}"
                    <button
                      onClick={() => {
                        setCurrentQuery("");
                        updateSearchParams("", currentTag);
                      }}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                
                {tag && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Topic: {tag}
                    <button
                      onClick={() => {
                        setCurrentTag("");
                        updateSearchParams(query, "");
                      }}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="text-xs"
                >
                  Clear all
                </Button>
              </div>
            </div>
          )}

          {/* Quick Search Buttons */}
          {!hasActiveFilters && (
            <div className="bg-muted/30 rounded-2xl p-8 text-center">
              <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Start your search
              </h2>
              <p className="text-muted-foreground mb-6">
                Enter keywords or browse by topic to find relevant content
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setCurrentQuery("artificial intelligence");
                    updateSearchParams("artificial intelligence", "");
                  }}
                  className="text-xs"
                >
                  AI Articles
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setCurrentTag("ml");
                    updateSearchParams("", "ml");
                  }}
                  className="text-xs"
                >
                  Machine Learning
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setCurrentTag("deep-learning");
                    updateSearchParams("", "deep-learning");
                  }}
                  className="text-xs"
                >
                  Deep Learning
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setCurrentQuery("neural networks");
                    updateSearchParams("neural networks", "");
                  }}
                  className="text-xs"
                >
                  Neural Networks
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
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

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 text-center">
              <p className="text-destructive font-medium mb-4">
                An error occurred while searching. Please try again.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          )}

          {/* Search Results */}
          {searchResults && !isLoading && hasActiveFilters && (
            <>
              {/* Results Header */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground text-center">
                  {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} found
                  {query && ` for "${query}"`}
                  {tag && ` in ${tag}`}
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
                    Try different keywords or browse all content
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={clearSearch}>
                      Clear filters
                    </Button>
                    <Button asChild>
                      <Link to="/feed">Browse All Content</Link>
                    </Button>
                  </div>
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