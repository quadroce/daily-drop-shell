import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEngagementState } from "@/hooks/useEngagementState";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { FeedItem } from "@/hooks/useInfiniteFeed";
import { supabase } from "@/integrations/supabase/client";

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
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { track } from "@/lib/analytics";
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

// Simple DropCard component (no virtualization)
const SimpleDropCard = ({ 
  drop, 
  updateEngagement, 
  getTopicSlug, 
  topicsLoading, 
  getState, 
  isLoading,
  topicsMap 
}: {
  drop: FeedItem;
  updateEngagement: (dropId: string, action: string) => Promise<boolean>;
  getTopicSlug: (label: string) => string;
  topicsLoading: boolean;
  getState: (dropId: string) => any;
  isLoading: (dropId: string) => boolean;
  topicsMap: { l1: Map<number, string>; l2: Map<number, string> };
}) => {
  const imageUrl = getImageUrl(drop);
  const dropId = drop.id.toString();
  const engagementState = getState(dropId);
  const loadingState = isLoading(dropId);

  console.log('🎯 Rendering SimpleDropCard for drop:', drop.id, drop.title);

  return (
    <TooltipProvider>
      <Card className="group hover:bg-card-hover transition-all duration-200 mb-4">
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

                {/* Ranking reason with score */}
                {drop.reason_for_ranking && (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs bg-primary/5 text-primary/80 border-primary/20"
                    >
                      {drop.l1_topic_id && topicsMap.l1.get(drop.l1_topic_id) 
                        ? `${topicsMap.l1.get(drop.l1_topic_id)} • ${drop.reason_for_ranking}`
                        : drop.reason_for_ranking}
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
                {/* L1 Topic */}
                {drop.l1_topic_id && topicsMap.l1.get(drop.l1_topic_id) && (
                  <Badge
                    key={`l1-${drop.l1_topic_id}`}
                    variant="secondary"
                    className="text-xs py-0 px-2 bg-blue-600 text-white"
                  >
                    {topicsMap.l1.get(drop.l1_topic_id)}
                  </Badge>
                )}
                
                {/* L2 Topic */}
                {drop.l2_topic_id && topicsMap.l2.get(drop.l2_topic_id) && (
                  <Badge
                    key={`l2-${drop.l2_topic_id}`}
                    variant="secondary"
                    className="text-xs py-0 px-2 bg-green-400 text-white"
                  >
                    {topicsMap.l2.get(drop.l2_topic_id)}
                  </Badge>
                )}
                
                {/* L3 Tags - Show available tags */}
                {drop.tags?.filter((tag) => tag && tag.trim()).map((tag: string) => (
                  topicsLoading || !getTopicSlug(tag) ? (
                    <Badge
                      key={`l3-${tag}`}
                      variant="outline"
                      className="text-xs py-0 px-1 bg-orange-400 text-white"
                    >
                      {tag}
                    </Badge>
                  ) : (
                    <ChipLink
                      key={`l3-${tag}`}
                      to={`/topics/${getTopicSlug(tag)}`}
                      variant="outline"
                      className="text-xs py-0 px-1 bg-orange-400 text-white hover:bg-orange-500"
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

          {/* Image Section - Right - Clickable */}
          <div className="relative w-28 h-28 m-4 overflow-hidden rounded-lg flex-shrink-0 cursor-pointer"
               onClick={() => {
                 track("content_click", {
                   drop_id: drop.id,
                   content_id: drop.id,
                   source: drop.source_name,
                   topic: drop.tags?.[0],
                 });
                 window.open(drop.url, "_blank");
               }}>
            {imageUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={imageUrl}
                  alt={drop.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
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

interface SimpleFeedListProps {
  items: FeedItem[];
  load: () => void;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function SimpleFeedList({ items, load, hasMore, loading, error, onRetry }: SimpleFeedListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { updateEngagement, getState, isLoading, initializeStates } = useEngagementState();
  const { getTopicSlug, isLoading: topicsLoading } = useTopicsMap();
  const [topicsMap, setTopicsMap] = useState<{ l1: Map<number, string>; l2: Map<number, string> }>({
    l1: new Map(),
    l2: new Map()
  });

  // Load L1 and L2 topics map
  useEffect(() => {
    const loadTopicsMap = async () => {
      try {
        const { data: topics } = await supabase
          .from('topics')
          .select('id, label, level')
          .in('level', [1, 2]);
        
        if (topics) {
          const l1Map = new Map<number, string>();
          const l2Map = new Map<number, string>();
          
          topics.forEach(topic => {
            if (topic.level === 1) {
              l1Map.set(topic.id, topic.label);
            } else if (topic.level === 2) {
              l2Map.set(topic.id, topic.label);
            }
          });
          
          setTopicsMap({ l1: l1Map, l2: l2Map });
        }
      } catch (error) {
        console.error('Failed to load topics map:', error);
      }
    };

    loadTopicsMap();
  }, []);

  console.log('🎯 SimpleFeedList render:', {
    itemsCount: items.length,
    loading,
    hasMore,
    error,
    items: items.slice(0, 3).map(i => ({ id: i.id, title: i.title }))
  });

  // Initialize engagement states when items change
  useEffect(() => {
    if (items.length > 0) {
      const dropIds = items.map(item => item.id.toString());
      console.log('🔄 Initializing engagement states for', dropIds.length, 'items');
      initializeStates(dropIds);
    }
  }, [items, initializeStates]);

  // Intersection Observer for infinite loading with better logging
  useEffect(() => {
    console.log('🔍 Setting up intersection observer:', { hasMore, loading });
    if (!hasMore) {
      console.log('❌ Intersection observer blocked - no more items:', { hasMore });
      return;
    }
    
    const el = sentinelRef.current;
    if (!el) {
      console.log('❌ No sentinel element found');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loading) {
            console.log('🔄 Intersection Observer triggered - loading more items');
            load();
          }
        });
      },
      { rootMargin: "600px 0px 600px 0px" }
    );

    console.log('✅ Observing sentinel element');
    io.observe(el);
    return () => {
      console.log('🧹 Cleaning up intersection observer');
      io.disconnect();
    };
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
    <div>
      {/* Render all items directly (no virtualization) */}
      <div className="space-y-4">
        {items.map((item) => (
          <SimpleDropCard
            key={item.id}
            drop={item}
            updateEngagement={updateEngagement}
            getTopicSlug={getTopicSlug}
            topicsLoading={topicsLoading}
            getState={getState}
            isLoading={isLoading}
            topicsMap={topicsMap}
          />
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

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
          <p className="text-muted-foreground mb-4">
            Try adjusting your preferences or check back later.
          </p>
        </div>
      )}
    </div>
  );
}