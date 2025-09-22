import { useEffect, useRef } from 'react';
import { FeedCard } from './FeedCard';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { useInfiniteTopicArticles } from '@/hooks/useInfiniteTopicArticles';
import { useAnalytics } from '@/lib/analytics';

interface InfiniteArticlesListProps {
  topicSlug: string;
}

export const InfiniteArticlesList = ({ topicSlug }: InfiniteArticlesListProps) => {
  const { track } = useAnalytics();
  const observerRef = useRef<HTMLDivElement>(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteTopicArticles(topicSlug);

  // Intersection Observer for auto-loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const allArticles = data?.pages.flatMap(page => page.articles) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-video rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-muted/30 rounded-2xl p-8 text-center">
        <p className="text-muted-foreground mb-4">
          Error loading articles. Please try again.
        </p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (allArticles.length === 0) {
    return (
      <div className="bg-muted/30 rounded-2xl p-8 text-center">
        <p className="text-muted-foreground mb-4">
          No articles found for this topic yet. Check back soon!
        </p>
        <Button variant="outline">
          Follow Topic for Updates
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allArticles.map((article) => (
          <FeedCard
            key={article.id}
            {...article}
            onEngage={(action) => {
              track('open_item', { 
                itemId: action.itemId, 
                topic: topicSlug,
                action: action.action
              });
            }}
          />
        ))}
      </div>

      {/* Loading trigger and more button */}
      <div ref={observerRef} className="mt-8">
        {isFetchingNextPage && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {hasNextPage && !isFetchingNextPage && (
          <div className="text-center">
            <Button 
              variant="outline" 
              onClick={() => fetchNextPage()}
              className="px-8"
            >
              Load More Articles
            </Button>
          </div>
        )}

        {!hasNextPage && allArticles.length > 12 && (
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              You've reached the end of the articles for this topic.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};