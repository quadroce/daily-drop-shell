import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Play, Heart, Bookmark, X, ThumbsDown } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { trackOpen } from "@/lib/trackers/content";
import { createDebouncedOpenTracker } from "@/lib/feedback";
import YouTubePlayer from "./YouTubePlayer";
import { ImagePlaceholder } from "./ui/image-placeholder";
import { useEngagementState } from "@/hooks/useEngagementState";
import { ShareButton } from "./ShareButton";
import { useEffect } from "react";

export type FeedCardProps = {
  id: string;
  type: "article" | "video";
  title: string;
  summary: string;
  imageUrl?: string;
  publishedAt: string;
  source: { name: string; url: string };
  tags: string[];
  l1Topic?: string;
  l2Topic?: string;
  href: string;
  youtubeId?: string;
  youtubeDuration?: number; // seconds
  youtubeViewCount?: number;
  isPremium?: boolean;
};

type FeedCardComponentProps = FeedCardProps & {
  user?: { isLoggedIn: boolean; isPremium: boolean };
  onEngage?: (e: { itemId: string; action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play"|"share" }) => void;
  position?: number;
};

export const FeedCard = ({ 
  id, 
  type, 
  title, 
  summary, 
  imageUrl, 
  publishedAt, 
  source, 
  tags, 
  l1Topic,
  l2Topic,
  href, 
  youtubeId, 
  youtubeDuration,
  youtubeViewCount,
  isPremium, 
  user,
  onEngage,
  position
}: FeedCardComponentProps) => {
  const { track } = useAnalytics();
  const { updateEngagement, getState, isLoading, initializeStates } = useEngagementState();
  
  // Create debounced open tracker for this component instance
  const debouncedOpenTracker = createDebouncedOpenTracker(2000);
  
  // Check if user is premium (for YouTube embeds)
  const isUserPremium = user?.isPremium || false;
  const showInlineVideo = type === "video" && youtubeId && isUserPremium;

  // Initialize engagement state for this drop
  useEffect(() => {
    initializeStates([id]);
  }, [id, initializeStates]);

  // Get current engagement state
  const engagementState = getState(id);
  const loadingState = isLoading(id);

  const baseParams = {
    content_id: id,
    source: source.name,
    topic_l1: l1Topic,
    topic_l2: l2Topic,
    position: position || 0,
    is_premium: isUserPremium
  };

  const handleEngagementAction = async (action: "save"|"dismiss"|"like"|"dislike") => {
    const success = await updateEngagement(id, action);
    if (success) {
      // Call legacy handler if provided
      onEngage?.({ itemId: id, action });
    }
  };

  const handleOpen = () => {
    trackOpen(baseParams);
    // Also track with debounced tracker for dwell time
    debouncedOpenTracker(Number(id));
    // Call legacy handler if provided
    onEngage?.({ itemId: id, action: "open" });
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleVideoPlay = () => {
    if (user?.isPremium && youtubeId) {
      // Premium users see inline video - tracking handled by YouTubePlayer
      track('video_play', { 
        content_id: id, 
        video_id: youtubeId,
        platform: 'youtube_inline_premium'
      });
    } else {
      // Free users open YouTube externally
      track('video_play', { 
        content_id: id, 
        video_id: youtubeId,
        platform: 'youtube_external'
      });
      window.open(`https://www.youtube.com/watch?v=${youtubeId}`, "_blank");
    }
    // Call legacy handler if provided
    onEngage?.({ itemId: id, action: "video_play" });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count?: number) => {
    if (!count) return '';
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    if (count < 1000000000) return `${(count / 1000000).toFixed(1)}M`;
    return `${(count / 1000000000).toFixed(1)}B`;
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow bg-background border">
      <CardContent className="p-0">
        <div className="flex flex-col h-full">
          {/* Image/Video Section */}
          <div className="relative w-full aspect-square overflow-hidden">
            {showInlineVideo ? (
              <div className="relative w-full h-full">
                <YouTubePlayer
                  videoId={youtubeId!}
                  contentId={id}
                  isPremium={true}
                  className="w-full h-full"
                />
                {/* Premium badge */}
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
                  Premium
                </div>
                {/* Video metadata overlay */}
                {(youtubeDuration || youtubeViewCount) && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs space-x-2">
                    {youtubeDuration && <span>{formatDuration(youtubeDuration)}</span>}
                    {youtubeViewCount && <span>• {formatViewCount(youtubeViewCount)} views</span>}
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="w-full h-full bg-cover bg-center cursor-pointer relative group"
                style={{ 
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted-foreground)/0.1))' 
                }}
                onClick={type === "video" ? handleVideoPlay : handleOpen}
              >
                {type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <div className="bg-black/70 rounded-full p-3 group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                )}
                {!user?.isPremium && youtubeId && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
                      Watch inline with Premium
                    </Badge>
                  </div>
                )}
                {(youtubeDuration || youtubeViewCount) && type === "video" && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs space-x-2">
                    {youtubeDuration && <span>{formatDuration(youtubeDuration)}</span>}
                    {youtubeViewCount && <span>• {formatViewCount(youtubeViewCount)} views</span>}
                  </div>
                )}
                {!imageUrl && (
                  <ImagePlaceholder className="absolute inset-0 border-0 rounded-none" />
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
                  {title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="truncate">{source.name || 'Unknown Source'}</span>
                  <span>•</span>
                  <time dateTime={publishedAt} className="whitespace-nowrap">
                    {new Date(publishedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </time>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleOpen} className="flex-shrink-0">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
              {summary}
            </p>

            <div className="flex items-center justify-between gap-2 mt-auto">
              <div className="flex gap-1 flex-wrap min-w-0 flex-1">
                {/* L1 Topic Badge */}
                {l1Topic && (
                  <Badge variant="tag-l1" className="text-xs py-0 px-2 truncate">
                    {l1Topic}
                  </Badge>
                )}
                
                {/* L2 Topic Badge */}
                {l2Topic && (
                  <Badge variant="tag-l2" className="text-xs py-0 px-2 truncate">
                    {l2Topic}
                  </Badge>
                )}
                
                {/* L3 Tags */}
                {tags.slice(0, l1Topic || l2Topic ? 1 : 2).map((tag, index) => (
                  <Badge key={`l3-${index}`} variant="tag-l3" className="text-xs py-0 px-2 truncate">
                    {tag}
                  </Badge>
                ))}
                
                {/* Show +N for remaining tags */}
                {tags.length > (l1Topic || l2Topic ? 1 : 2) && (
                  <Badge variant="tag-l3" className="text-xs py-0 px-2">
                    +{tags.length - (l1Topic || l2Topic ? 1 : 2)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEngagementAction("like")}
                  disabled={loadingState}
                  className={`h-7 w-7 p-0 ${engagementState.isLiked ? 'text-rose-600' : ''}`}
                  aria-pressed={engagementState.isLiked}
                  aria-label={engagementState.isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart className={`h-3 w-3 ${engagementState.isLiked ? 'fill-current' : ''}`} />
                </Button>
                
                {/* Hide Save button if item is liked (auto-saved) */}
                {!engagementState.isLiked && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEngagementAction("save")}
                    disabled={loadingState}
                    className={`h-7 w-7 p-0 ${engagementState.isSaved ? 'text-primary' : ''}`}
                    aria-pressed={engagementState.isSaved}
                    aria-label={engagementState.isSaved ? 'Unsave' : 'Save'}
                  >
                    <Bookmark className={`h-3 w-3 ${engagementState.isSaved ? 'fill-current' : ''}`} />
                  </Button>
                )}
                
                <ShareButton 
                  dropId={id}
                  title={title}
                  url={href}
                  disabled={loadingState}
                />
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEngagementAction("dislike")}
                  disabled={loadingState}
                  className={`h-7 w-7 p-0 ${engagementState.isDisliked ? 'text-slate-600' : ''}`}
                  aria-pressed={engagementState.isDisliked}
                  aria-label={engagementState.isDisliked ? 'Remove dislike' : 'Dislike'}
                >
                  <ThumbsDown className={`h-3 w-3 ${engagementState.isDisliked ? 'fill-current' : ''}`} />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEngagementAction("dismiss")}
                  disabled={loadingState}
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