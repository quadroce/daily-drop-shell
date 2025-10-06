import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Heart, Bookmark, X, ExternalLink, Play, ThumbsDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEngagementState } from "@/hooks/useEngagementState";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { FeedItem } from "@/hooks/useInfiniteFeed";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChipLink } from "@/components/ChipLink";
import { track } from "@/lib/analytics";
import { format } from "date-fns";
import YouTubePlayer from "@/components/YouTubePlayer";
import { getYouTubeVideoId, getYouTubeThumbnailFromUrl } from "@/lib/youtube";
import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";

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
  };

  const handleOpen = () => {
    track('content_click', {
      drop_id: drop.id,
      content_id: drop.id,
      source: drop.source_name,
    });
    window.open(drop.url, '_blank', 'noopener,noreferrer');
  };

  const l1 = drop.l1_topic_id;
  const l2 = drop.l2_topic_id;
  const l3Items = drop.tags || [];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow bg-background border">
      <CardContent className="p-0">
        <div className="flex flex-col h-full">
          {/* Image/Video Section */}
          <div className="relative w-full aspect-square overflow-hidden">
            {drop.type === 'video' && videoId ? (
              <div className="relative w-full h-full">
                {imageUrl && !imageError && (
                  <img
                    src={imageUrl}
                    alt={drop.title}
                    className="w-full h-full object-cover absolute inset-0"
                    onError={() => setImageError(true)}
                    loading="lazy"
                  />
                )}
                <YouTubePlayer
                  videoId={videoId}
                  contentId={drop.id.toString()}
                  isPremium={true}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div 
                className="w-full h-full bg-cover bg-center cursor-pointer relative group"
                style={{ 
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted-foreground)/0.1))' 
                }}
                onClick={handleOpen}
              >
                {drop.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <div className="bg-black/70 rounded-full p-3 group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h3 
                  className="font-semibold text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors text-sm leading-tight"
                  onClick={handleOpen}
                >
                  {drop.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                  {showBadges && (
                    <>
                      {drop.reason_for_ranking?.includes('Fresh') && (
                        <Badge variant="default" className="text-xs py-0 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                          Fresh
                        </Badge>
                      )}
                      {drop.reason_for_ranking?.toLowerCase().includes('match') && (
                        <Badge variant="default" className="text-xs py-0 px-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                          Match
                        </Badge>
                      )}
                    </>
                  )}
                  <span className="truncate">{drop.source_name || 'Unknown Source'}</span>
                  <span>•</span>
                  <time dateTime={drop.published_at} className="whitespace-nowrap">
                    {format(new Date(drop.published_at), 'MMM d, yyyy')}
                  </time>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleOpen} className="flex-shrink-0">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
              {drop.summary}
            </p>

            <div className="flex items-center justify-between gap-2 mt-auto">
              <div className="flex gap-1 flex-wrap min-w-0 flex-1">
                {l1 && topicsMap.l1.get(l1) && (
                  <ChipLink 
                    to={`/topics/${topicsMap.l1.get(l1)!.slug}`} 
                    variant="tag-l1" 
                    className="text-xs py-0 px-2 truncate"
                    level={1}
                  >
                    {topicsMap.l1.get(l1)!.label}
                  </ChipLink>
                )}
                
                {l2 && topicsMap.l2.get(l2) && (
                  <ChipLink 
                    to={`/topics/${topicsMap.l2.get(l2)!.slug}`} 
                    variant="tag-l2" 
                    className="text-xs py-0 px-2 truncate"
                    level={2}
                  >
                    {topicsMap.l2.get(l2)!.label}
                  </ChipLink>
                )}
                
                {l3Items.slice(0, l1 || l2 ? 1 : 2).map((tag, index) => {
                  const slug = topicsMap.l3.get(tag);
                  const linkTo = slug ? `/topics/${slug}` : `/search?q=${encodeURIComponent(tag)}`;
                  return (
                    <ChipLink 
                      key={`l3-${index}`}
                      to={linkTo} 
                      variant="tag-l3" 
                      className="text-xs py-0 px-2 truncate"
                      level={3}
                      position={index}
                    >
                      {tag}
                    </ChipLink>
                  );
                })}
                
                {l3Items.length > (l1 || l2 ? 1 : 2) && (
                  <Badge variant="tag-l3" className="text-xs py-0 px-2">
                    +{l3Items.length - (l1 || l2 ? 1 : 2)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("like")}
                  disabled={loading}
                  className={`h-7 w-7 p-0 ${state.isLiked ? 'text-rose-600' : ''}`}
                  aria-pressed={state.isLiked}
                  aria-label={state.isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart className={`h-3 w-3 ${state.isLiked ? 'fill-current' : ''}`} />
                </Button>
                
                {!state.isLiked && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleAction("save")}
                    disabled={loading}
                    className={`h-7 w-7 p-0 ${state.isSaved ? 'text-primary' : ''}`}
                    aria-pressed={state.isSaved}
                    aria-label={state.isSaved ? 'Unsave' : 'Save'}
                  >
                    <Bookmark className={`h-3 w-3 ${state.isSaved ? 'fill-current' : ''}`} />
                  </Button>
                )}
                
                <ShareButton 
                  dropId={drop.id.toString()}
                  title={drop.title}
                  url={drop.url}
                  disabled={loading}
                />
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("dismiss")}
                  disabled={loading}
                  className="h-7 w-7 p-0"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
