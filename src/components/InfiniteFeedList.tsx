import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FeedItem } from "@/hooks/useInfiniteFeed";

// Skeleton component for loading states
const FeedItemSkeleton = () => (
  <div className="mb-4">
    <div className="border rounded-lg p-4">
      <div className="flex">
        <div className="flex-1 pr-4">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-3" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-2/3 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        </div>
        <Skeleton className="w-28 h-28 rounded-lg" />
      </div>
    </div>
  </div>
);

interface InfiniteFeedListProps {
  items: FeedItem[];
  load: () => void;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
  initialLoading: boolean;
  renderItem: (item: FeedItem, index: number) => React.ReactNode;
}

export function InfiniteFeedList({
  items,
  load,
  hasMore,
  loading,
  error,
  retry,
  initialLoading,
  renderItem
}: InfiniteFeedListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading || error) return;
    
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            load();
          }
        });
      },
      { rootMargin: '600px 0px 600px 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, error, load]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height of each feed item
    overscan: 10, // Render 10 extra items outside viewport
  });

  // Show initial loading skeletons
  if (initialLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <FeedItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Show error state
  if (error && items.length === 0) {
    return (
      <Alert className="border-destructive/50 bg-destructive/5">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load feed: {error}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={retry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Show empty state
  if (!loading && items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No items found in your feed.</p>
        <Button onClick={retry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <div className="mb-4">
              {renderItem(items[virtualItem.index], virtualItem.index)}
            </div>
          </div>
        ))}
      </div>

      {/* Intersection observer sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading indicator */}
      {loading && items.length > 0 && (
        <div className="py-6 text-center">
          <div className="text-sm text-muted-foreground mb-4">Loading more items...</div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <FeedItemSkeleton key={`loading-${i}`} />
            ))}
          </div>
        </div>
      )}

      {/* End of feed message */}
      {!hasMore && items.length > 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full">
            ✨ You're all caught up! Check back later for more content.
          </div>
        </div>
      )}

      {/* Error banner for load more errors */}
      {error && items.length > 0 && (
        <div className="py-4">
          <Alert className="border-destructive/50 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load more items: {error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={retry}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}