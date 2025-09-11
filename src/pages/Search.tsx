import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { FeedCard } from "@/components/FeedCard";
import { SearchBox } from "@/components/SearchBox";
import { SearchFilters } from "@/components/SearchFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Search as SearchIcon } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { searchContent } from "@/lib/api/search";
import type { SearchFiltersType, SearchResult } from "@/lib/api/search";

export const Search = () => {
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
  const [filters, setFilters] = useState<SearchFiltersType>({
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
    queryKey: ['search', query, source, tag, dateFrom, dateTo, page],
    queryFn: () => searchContent({
      query: query || undefined,
      source: source || undefined,
      tag: tag || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: 12
    }),
    enabled: !!(query || source || tag || dateFrom || dateTo),
  });

  const updateSearchParams = (newQuery?: string, newFilters?: Partial<SearchFiltersType>) => {
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

  const handleSearch = (newQuery: string) => {
    setCurrentQuery(newQuery);
    updateSearchParams(newQuery);
    
    track('search_performed', {
      query: newQuery,
      source,
      tag,
      dateFrom,
      dateTo
    });
  };

  const handleFilterChange = (newFilters: Partial<SearchFiltersType>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    updateSearchParams(undefined, newFilters);
    
    track('filters_applied', {
      query,
      ...updatedFilters
    });
  };

  const clearFilter = (filterKey: keyof SearchFiltersType) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    setFilters(newFilters);
    
    const params = new URLSearchParams(searchParams);
    const paramKey = filterKey === 'dateFrom' ? 'date_from' : 
                     filterKey === 'dateTo' ? 'date_to' : 
                     String(filterKey);
    params.delete(paramKey);
    setSearchParams(params);
  };

  const clearAllFilters = () => {
    setFilters({});
    setCurrentQuery("");
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = query || source || tag || dateFrom || dateTo;
  const hasResults = searchResults && searchResults.results.length > 0;

  // SEO setup
  const seoTitle = query 
    ? `Search results for "${query}" - DailyDrops`
    : "Advanced Search - DailyDrops";
  
  const seoDescription = query
    ? `Find articles, videos, and content related to "${query}". ${searchResults?.total || 0} results found.`
    : "Search through thousands of AI & ML articles, videos, and resources with advanced filters by source, tags, and date.";

  const canonical = `${window.location.origin}/search${window.location.search}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "name": seoTitle,
    "description": seoDescription,
    "url": canonical,
    ...(query && {
      "mainEntity": {
        "@type": "SearchAction",
        "query-input": "required name=search_term_string",
        "target": `${window.location.origin}/search?q={search_term_string}`
      }
    })
  };

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonical={canonical}
        jsonLd={jsonLd}
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
          <div className="mb-6">
            <SearchBox
              value={currentQuery}
              onChange={setCurrentQuery}
              onSearch={handleSearch}
              placeholder="Search for articles, videos, topics..."
              size="large"
            />
          </div>

          {/* Filters */}
          <div className="mb-6">
            <SearchFilters
              filters={filters}
              onChange={handleFilterChange}
            />
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
                
                {source && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Source: {source}
                    <button
                      onClick={() => clearFilter('source')}
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
                
                {(dateFrom || dateTo) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Date: {dateFrom || 'start'} - {dateTo || 'end'}
                    <button
                      onClick={() => {
                        clearFilter('dateFrom');
                        clearFilter('dateTo');
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
                <Button variant="outline" size="sm" asChild>
                  <Link to="/search?tag=ai">AI Articles</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/search?tag=ml">Machine Learning</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/search?source=youtube">YouTube Videos</Link>
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
                  {searchResults.total > 0 && ` • Page ${page} of ${Math.ceil(searchResults.total / 12)}`}
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
                          source,
                          tag,
                          action: action.action,
                          position: searchResults.results.findIndex(r => r.id === action.itemId) + 1
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

              {/* Pagination */}
              {searchResults.total > 12 && (
                <div className="flex justify-center gap-2">
                  {page > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set("page", (page - 1).toString());
                        setSearchParams(params);
                      }}
                    >
                      Previous
                    </Button>
                  )}
                  
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(searchResults.total / 12)}
                  </span>
                  
                  {page < Math.ceil(searchResults.total / 12) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set("page", (page + 1).toString());
                        setSearchParams(params);
                      }}
                    >
                      Next
                    </Button>
                  )}
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