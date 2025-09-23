import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEngagementState } from "@/hooks/useEngagementState";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { track } from "@/lib/analytics";
import { FeedItem } from "@/hooks/useInfiniteFeed";

// Import the existing DropCard component
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChipLink } from "@/components/ChipLink";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bookmark,
  ExternalLink,
  Heart,
  Image,
  Play,
  Star,
  ThumbsDown,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import {
  getYouTubeFallbackThumbnail,
  getYouTubeThumbnailFromUrl,
} from "@/lib/youtube";

// Helper function for getting image URLs
const getImageUrl = (drop: FeedItem) => {
  if (drop.type === "video" && drop.url) {
    const thumbnailUrl = getYouTubeThumbnailFromUrl(drop.url);
    if (thumbnailUrl) return thumbnailUrl;
  }
  return drop.image_url;
};

// DropCard component adapted for infinite scroll
const InfiniteDropCard = ({ 
  drop, 
  updateEngagement, 
  getTopicSlug, 
  topicsLoading, 
  getState, 
  isLoading 
}: {
  drop: FeedItem;
  updateEngagement: (dropId: string, action: string) => Promise<boolean>;
  getTopicSlug: (label: string) => string;
  topicsLoading: boolean;
  getState: (dropId: string) => any;
  isLoading: (dropId: string) => boolean;
}) => {
  const imageUrl = getImageUrl(drop);
  const dropId = drop.id.toString();
  const engagementState = getState(dropId);
  const loadingState = isLoading(dropId);

  return (
    <TooltipProvider>
      <Card className="group hover:bg-card-hover transition-all duration-200">
        <div className="flex">
          {/* Content Section - Left */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                  <a
                    href={drop.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {drop.title}
                  </a>
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground truncate">
                    {drop.source_name || "Unknown Source"}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {drop.published_at
                      ? new Date(drop.published_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : new Date().toLocaleDateString("en-US", {
                          month: "short", 
                          day: "numeric",
                          year: "numeric",
                        })}
                  </time>
                </div>

                {/* Ranking reason */}
                {drop.reason_for_ranking && (
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs bg-primary/5 text-primary/80 border-primary/20"
                    >
                      {drop.reason_for_ranking}
                    </Badge>
                  </div>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-6 w-6"
                    onClick={() => {
                      track("content_click", {
                        drop_id: drop.id,
                        content_id: drop.id,
                        source: drop.source_name,
                        topic: drop.tags?.[0],
                      });
                      window.open(drop.url, "_blank");
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open link</TooltipContent>
              </Tooltip>
            </div>

            {/* Synopsis */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground line-clamp-2">
                {drop.summary || "No summary available."}
              </p>
            </div>

            {/* Tags and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {/* L3 Tags - Show available tags */}
                {drop.tags?.filter((tag) => tag && tag.trim()).map((tag: string) => (
                  topicsLoading || !getTopicSlug(tag) ? (
                    <Badge
                      key={`l3-${tag}`}
                      variant="tag-l3"
                      className="text-xs py-0 px-1"
                    >
                      {tag}
                    </Badge>
                  ) : (
                    <ChipLink
                      key={`l3-${tag}`}
                      to={`/topics/${getTopicSlug(tag)}`}
                      variant="tag-l3"
                      className="text-xs py-0 px-1"
                    >
                      {tag}
                    </ChipLink>
                  )
                ))}
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${
                        engagementState.isLiked
                          ? "bg-success/20 text-success hover:bg-success/30"
                          : "hover:bg-success/10 hover:text-success"
                      }`}
                      disabled={loadingState}
                      aria-pressed={engagementState.isLiked}
                      onClick={async () => {
                        const success = await updateEngagement(dropId, "like");
                        if (success) {
                          track("like_item", {
                            drop_id: drop.id,
                            content_id: drop.id,
                            source: drop.source_name,
                            topic: drop.tags?.[0],
                          });
                        }
                      }}
                    >
                      <Heart
                        className={`h-3 w-3 ${
                          engagementState.isLiked ? "fill-current" : ""
                        }`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {engagementState.isLiked ? "Unlike" : "Like"}
                  </TooltipContent>
                </Tooltip>

                {!engagementState.isLiked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${
                          engagementState.isSaved
                            ? "bg-success/20 text-success hover:bg-success/30"
                            : "hover:bg-success/10 hover:text-success"
                        }`}
                        disabled={loadingState}
                        aria-pressed={engagementState.isSaved}
                        onClick={async () => {
                          const success = await updateEngagement(dropId, "save");
                          if (success) {
                            track("save_item", {
                              drop_id: drop.id,
                              content_id: drop.id,
                              source: drop.source_name,
                              topic: drop.tags?.[0],
                            });
                          }
                        }}
                      >
                        <Bookmark
                          className={`h-3 w-3 ${
                            engagementState.isSaved ? "fill-current" : ""
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {engagementState.isSaved ? "Unsave" : "Save"}
                    </TooltipContent>
                  </Tooltip>
                )}

                <ShareButton
                  dropId={dropId}
                  title={drop.title}
                  url={drop.url}
                  disabled={loadingState}
                  className="h-6 w-6"
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${
                        engagementState.isDismissed
                          ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                          : "hover:bg-destructive/10 hover:text-destructive"
                      }`}
                      disabled={loadingState}
                      aria-pressed={engagementState.isDismissed}
                      onClick={async () => {
                        const success = await updateEngagement(dropId, "dismiss");
                        if (success) {
                          track("dismiss_item", {
                            drop_id: drop.id,
                            content_id: drop.id,
                            source: drop.source_name,
                            topic: drop.tags?.[0],
                          });
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {engagementState.isDismissed ? "Undismiss" : "Dismiss"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Image Section - Right */}
          <div className="relative w-28 h-28 m-4 overflow-hidden rounded-lg flex-shrink-0">
            {imageUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={imageUrl}
                  alt={drop.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Try fallback for YouTube videos
                    if (drop.type === "video" && drop.url) {
                      const fallbackUrl = getYouTubeFallbackThumbnail(drop.url);
                      if (fallbackUrl && e.currentTarget.src !== fallbackUrl) {
                        e.currentTarget.src = fallbackUrl;
                        return;
                      }
                    }

                    // Hide image and show placeholder
                    e.currentTarget.style.display = "none";
                    const placeholder = e.currentTarget.closest(".relative")
                      ?.querySelector("[data-placeholder]");
                    placeholder?.classList.remove("hidden");
                  }}
                />
                {drop.type === "video" && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full p-1">
                      <Play className="h-3 w-3 text-white fill-white" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />

                <div
                  data-placeholder
                  className="hidden absolute inset-0 bg-muted flex items-center justify-center"
                >
                  <div className="text-center text-muted-foreground">
                    <Image className="h-4 w-4 mx-auto mb-1" />
                    <p className="text-xs">No image</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Image className="h-4 w-4 mx-auto mb-1" />
                  <p className="text-xs">No image</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};

interface InfiniteFeedListProps {
  items: FeedItem[];
  load: () => void;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function InfiniteFeedList({ items, load, hasMore, loading, error, onRetry }: InfiniteFeedListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { updateEngagement, getState, isLoading } = useEngagementState();
  const { getTopicSlug, isLoading: topicsLoading } = useTopicsMap();

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Approximate card height
    overscan: 5,
  });

  // Intersection Observer for infinite loading
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            load();
          }
        });
      },
      { rootMargin: "600px 0px 600px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, load]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error loading feed</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          {error}
        </p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="p-2">
                <InfiniteDropCard
                  drop={item}
                  updateEngagement={updateEngagement}
                  getTopicSlug={getTopicSlug}
                  topicsLoading={topicsLoading}
                  getState={getState}
                  isLoading={isLoading}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} />

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4 p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="w-28 h-28 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* End of feed message */}
      {!hasMore && items.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            You're all caught up! 🎉
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="text-6xl mb-4">📰</div>
          <h3 className="text-lg font-semibold mb-2">No articles found</h3>
          <p className="text-muted-foreground max-w-md">
            We couldn't find any articles matching your preferences. Try adjusting your filters or check back later.
          </p>
        </div>
      )}
    </div>
  );
}