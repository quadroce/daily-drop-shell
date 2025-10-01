import { useEffect, useRef } from 'react';
import { FeedCard } from './FeedCard';
import { SignupPromoCard } from './SignupPromoCard';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { useInfiniteTopicArticles } from '@/hooks/useInfiniteTopicArticles';
import { useAnalytics } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

interface InfiniteArticlesListWithPromoProps {
  topicSlug: string;
  promoCardInterval?: number;
  utmSource?: string;
}

export const InfiniteArticlesListWithPromo = ({
  topicSlug,
  promoCardInterval = 9,
  utmSource = 'topics'
}: InfiniteArticlesListWithPromoProps) => {
  const { track } = useAnalytics();
  const { user } = useAuth();
  const observerRef = useRef<HTMLDivElement>(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteTopicArticles(topicSlug);

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

  const itemsWithPromos = [];
  let promoCount = 0;

  for (let i = 0; i < allArticles.length; i++) {
    itemsWithPromos.push({ type: 'article' as const, data: allArticles[i], index: i });

    if (!user && (i + 1) % promoCardInterval === 0 && i < allArticles.length - 1) {
      itemsWithPromos.push({ type: 'promo' as const, promoIndex: promoCount });
      promoCount++;
    }
  }

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
        {itemsWithPromos.map((item, idx) => {
          if (item.type === 'promo') {
            return (
              <SignupPromoCard
                key={`promo-${item.promoIndex}`}
                utmSource={utmSource}
                utmCampaign="grid_card"
                position={item.promoIndex}
              />
            );
          }

          return (
            <FeedCard
              key={item.data.id}
              {...item.data}
              onEngage={(action) => {
                track('open_item', {
                  itemId: action.itemId,
                  topic: topicSlug,
                  action: action.action
                });
              }}
            />
          );
        })}
      </div>

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
