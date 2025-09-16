import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Play, Heart, Bookmark, X } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { trackOpen, trackSave, trackDismiss, trackLike, trackDislike } from "@/lib/trackers/content";
import { useFeedback, createDebouncedOpenTracker } from "@/lib/feedback";
import YouTubePlayer from "./YouTubePlayer";
import { ImagePlaceholder } from "./ui/image-placeholder";

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
  onEngage?: (e: { itemId: string; action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play" }) => void;
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
  const { sendFeedback } = useFeedback();
  
  // Create debounced open tracker for this component instance
  const debouncedOpenTracker = createDebouncedOpenTracker(2000);
  
  // Check if user is premium (for YouTube embeds)
  const isUserPremium = user?.isPremium || false;
  const showInlineVideo = type === "video" && youtubeId && isUserPremium;

  const baseParams = {
    content_id: id,
    source: source.name,
    topic_l1: l1Topic,
    topic_l2: l2Topic,
    position: position || 0,
    is_premium: isUserPremium
  };

  const handleAction = async (action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play") => {
    // Send feedback to the new system
    if (action !== 'video_play') {
      await sendFeedback(action, Number(id));
    }
    
    // Track with existing analytics (for legacy compatibility)
    switch(action) {
      case 'save':
        trackSave(baseParams);
        break;
      case 'dismiss':
        trackDismiss(baseParams);
        break;
      case 'like':
        trackLike(baseParams);
        break;
      case 'dislike':
        trackDislike(baseParams);
        break;
      case 'open':
        trackOpen(baseParams);
        break;
      case 'video_play':
        track('video_play', { ...baseParams, video_id: youtubeId });
        break;
    }

    // Call legacy handler if provided
    onEngage?.({ itemId: id, action });
  };

  const handleOpen = () => {
    handleAction("open");
    // Also track with debounced tracker for dwell time
    debouncedOpenTracker(Number(id));
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleVideoPlay = () => {
    handleAction("video_play");
    if (user?.isPremium && youtubeId) {
      // Premium users see inline video - tracking handled by YouTubePlayer
      track('video_play', { 
        content_id: id, 
        video_id: youtubeId,
        platform: 'youtube_inline_premium'
      });
      return;
    }
    // Free users open YouTube externally
    track('video_play', { 
      content_id: id, 
      video_id: youtubeId,
      platform: 'youtube_external'
    });
    window.open(`https://www.youtube.com/watch?v=${youtubeId}`, "_blank");
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
                  onClick={() => handleAction("like")}
                  className="h-7 w-7 p-0"
                >
                  <Heart className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("save")}
                  className="h-7 w-7 p-0"
                >
                  <Bookmark className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("dismiss")}
                  className="h-7 w-7 p-0"
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