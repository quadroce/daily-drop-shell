import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Heart, Bookmark, X, Share2, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEngagementState } from "@/hooks/useEngagementState";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { FeedItem } from "@/hooks/useInfiniteFeed";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChipLink } from "@/components/ChipLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { track } from "@/lib/analytics";
import { format } from "date-fns";
import YouTubePlayer from "@/components/YouTubePlayer";
import { getYouTubeVideoId, getYouTubeThumbnailFromUrl } from "@/lib/youtube";

interface SimpleDropCardProps {
  drop: FeedItem;
  updateEngagement: (dropId: string, action: string) => Promise<boolean>;
  getTopicSlug: (label: string) => string;
  topicsLoading: boolean;
  getState: (dropId: string) => any;
  isLoading: (dropId: string) => boolean;
  topicsMap: { l1: Map<number, { label: string; slug: string }>; l2: Map<number, { label: string; slug: string }>; l3: Map<string, string> };
}

const SimpleDropCard = ({ drop, updateEngagement, getTopicSlug, topicsLoading, getState, isLoading, topicsMap }: SimpleDropCardProps) => {
  console.log('🎯 Rendering SimpleDropCard for drop:', drop.id, drop.title);
  
  const [imageError, setImageError] = useState(false);
  const state = getState(drop.id.toString());
  const loading = isLoading(drop.id.toString());

  // Extract video ID from URL if not in database
  const videoId = drop.youtube_video_id || (drop.type === 'video' ? getYouTubeVideoId(drop.url) : null);
  
  // Generate thumbnail from URL if not in database
  const imageUrl = drop.image_url || 
                   drop.youtube_thumbnail_url || 
                   (drop.type === 'video' ? getYouTubeThumbnailFromUrl(drop.url) : null);
  const showBadges = drop.reason_for_ranking && drop.reason_for_ranking !== 'Relevant content';

  const handleAction = async (action: 'like' | 'save' | 'dismiss') => {
    await updateEngagement(drop.id.toString(), action);
    track(`${action}_item`, {
      drop_id: drop.id,
      content_id: drop.id,
      source: drop.source_name,
      topic: drop.tags?.[0],
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: drop.title,
        url: drop.url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(drop.url);
    }
    track('share_item', {
      drop_id: drop.id,
      content_id: drop.id,
      source: drop.source_name,
      topic: drop.tags?.[0],
    });
  };

  return (
    <TooltipProvider>
      <Card className="group hover:shadow-md transition-shadow h-full flex flex-col">
        <CardContent className="p-4 flex flex-col h-full">
          {/* Image/Video on top */}
          <div className="w-full aspect-video relative mb-3">
            {drop.type === 'video' && videoId ? (
              <div className="w-full h-full rounded overflow-hidden relative">
                {imageUrl && !imageError && (
                  <img
                    src={imageUrl}
                    alt={drop.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setImageError(true)}
                    loading="lazy"
                  />
                )}
                <YouTubePlayer
                  videoId={videoId}
                  contentId={drop.id.toString()}
                  className="relative w-full h-full z-10"
                  isPremium={true}
                  lazy={true}
                />
              </div>
            ) : imageUrl && !imageError ? (
              <div 
                className="relative w-full h-full cursor-pointer"
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
                <img
                  src={imageUrl}
                  alt={drop.title}
                  className="w-full h-full object-cover rounded hover:scale-105 transition-transform duration-200"
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 rounded flex items-center justify-center">
                <span className="text-4xl opacity-50">
                  {drop.type === 'video' ? '🎥' : '📰'}
                </span>
              </div>
            )}
          </div>

          {/* Badges */}
          {showBadges && (
            <div className="flex flex-wrap gap-1 mb-2">
              {drop.reason_for_ranking?.includes('Fresh') && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                  ✨ Fresh
                </span>
              )}
              {drop.reason_for_ranking?.includes('interest') && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  🎯 Match
                </span>
              )}
            </div>
          )}

          {/* Source and date */}
          {(drop.source_name || drop.published_at) && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              {drop.source_name && (
                <span className="font-medium truncate">{drop.source_name}</span>
              )}
              {drop.published_at && (
                <>
                  <span>•</span>
                  <time dateTime={drop.published_at} className="truncate">
                    {format(new Date(drop.published_at), "MMM d")}
                  </time>
                </>
              )}
            </div>
          )}

          {/* Title with link */}
          <a
            href={drop.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link block mb-2"
            onClick={(e) => {
              e.stopPropagation();
              track("content_click", {
                drop_id: drop.id,
                content_id: drop.id,
                source: drop.source_name,
                topic: drop.tags?.[0],
              });
            }}
          >
            <h3 className="font-semibold text-sm text-foreground group-hover/link:text-primary transition-colors line-clamp-2 flex items-start gap-1">
              {drop.title}
              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
            </h3>
          </a>

          {/* Summary */}
          {drop.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {drop.summary}
            </p>
          )}

          {/* Tags: L1, L2, L3 */}
          <div className="flex flex-wrap gap-1 mb-3">
            {/* L1 Topic */}
            {drop.l1_topic_id && topicsMap.l1.get(drop.l1_topic_id) && (
              <ChipLink
                to={`/topics/${topicsMap.l1.get(drop.l1_topic_id)!.slug}`}
                position={0}
                variant="secondary"
                className="bg-blue-600 text-white hover:bg-blue-700 text-xs"
              >
                {topicsMap.l1.get(drop.l1_topic_id)!.label}
              </ChipLink>
            )}
            
            {/* L2 Topic */}
            {drop.l2_topic_id && topicsMap.l2.get(drop.l2_topic_id) && (
              <ChipLink
                to={`/topics/${topicsMap.l2.get(drop.l2_topic_id)!.slug}`}
                position={1}
                variant="secondary"
                className="bg-green-500 text-white hover:bg-green-600 text-xs"
              >
                {topicsMap.l2.get(drop.l2_topic_id)!.label}
              </ChipLink>
            )}
            
            {/* L3 Tags */}
            {drop.tags && drop.tags.map((tag, index) => {
              const slug = topicsMap.l3.get(tag);
              return slug ? (
                <ChipLink
                  key={tag}
                  to={`/topics/${slug}`}
                  position={2 + index}
                  variant="outline"
                  className="bg-orange-400 text-white hover:bg-orange-500 text-xs"
                >
                  {tag}
                </ChipLink>
              ) : null;
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 pt-2 mt-auto border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('like')}
                  disabled={loading}
                  className={state?.isLiked ? "text-red-500" : ""}
                >
                  <Heart className={`h-4 w-4 ${state?.isLiked ? "fill-current" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Like</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('save')}
                  disabled={loading}
                  className={state?.isSaved ? "text-blue-500" : ""}
                >
                  <Bookmark className={`h-4 w-4 ${state?.isSaved ? "fill-current" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  disabled={loading}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('dismiss')}
                  disabled={loading}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
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
  const [topicsMap, setTopicsMap] = useState<{ 
    l1: Map<number, { label: string; slug: string }>; 
    l2: Map<number, { label: string; slug: string }>;
    l3: Map<string, string>;
  }>({
    l1: new Map(),
    l2: new Map(),
    l3: new Map()
  });

  // Load all topics map (L1, L2, L3)
  useEffect(() => {
    const loadTopicsMap = async () => {
      try {
        const { data: topics } = await supabase
          .from('topics')
          .select('id, label, slug, level')
          .in('level', [1, 2, 3]);
        
        if (topics) {
          const l1Map = new Map<number, { label: string; slug: string }>();
          const l2Map = new Map<number, { label: string; slug: string }>();
          const l3Map = new Map<string, string>();
          
          topics.forEach(topic => {
            if (topic.level === 1) {
              l1Map.set(topic.id, { label: topic.label, slug: topic.slug });
            } else if (topic.level === 2) {
              l2Map.set(topic.id, { label: topic.label, slug: topic.slug });
            } else if (topic.level === 3) {
              l3Map.set(topic.label, topic.slug);
            }
          });
          
          setTopicsMap({ l1: l1Map, l2: l2Map, l3: l3Map });
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

  // Intersection Observer for infinite loading
  useEffect(() => {
    console.log('🔍 Setting up intersection observer:', { hasMore, loading });
    if (!hasMore) {
      console.log('❌ Intersection observer blocked - no more items');
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
          if (entry.isIntersecting && !loading && hasMore) {
            console.log('🔄 Intersection Observer triggered - loading more items');
            setTimeout(() => {
              console.log('⏰ Triggering load after timeout');
              load();
            }, 100);
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
        <p className="text-muted-foreground mb-4 max-w-md">{error}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div>
      {items.length === 0 && !loading && !error && (
        <div className="text-center py-16 space-y-4">
          <div className="text-6xl">📭</div>
          <h3 className="text-xl font-semibold text-foreground">No drops yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your personalized feed is being prepared. Check back soon!
          </p>
        </div>
      )}

      {/* Grid 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((drop) => (
          <SimpleDropCard
            key={drop.id}
            drop={drop}
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
      <div ref={sentinelRef} className="h-4 mt-6" />

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Skeleton className="w-full aspect-video rounded" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>You've reached the end of your feed</p>
        </div>
      )}
    </div>
  );
}
