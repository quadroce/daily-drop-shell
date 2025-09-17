import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Heart, Bookmark, X, ThumbsDown, ExternalLink, Crown } from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChipLink } from './ChipLink';
import { trackVideoPlay, trackVideoPause, trackVideoComplete } from '@/lib/trackers/content';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useEngagementState } from '@/hooks/useEngagementState';

interface FullWidthVideoCardProps {
  item: {
    id: string | number;
    title: string;
    url: string;
    summary?: string;
    source?: string;
    published_at?: string;
    tags?: string[];
    l1_topic?: string;
    l2_topic?: string;
    youtube_video_id?: string;
    youtube_thumbnail_url?: string;
    youtube_duration_seconds?: number;
    youtube_view_count?: number;
  };
  onSave?: (id: string | number) => void;
  onLike?: (id: string | number) => void;
  onDismiss?: (id: string | number) => void;
}

// YouTube video ID extraction
const extractVideoId = (url: string, videoId?: string): string | null => {
  if (videoId) return videoId;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

// Check if URL is YouTube
const isYouTubeUrl = (url: string): boolean => {
  return /youtu(\.be|be\.com)/.test(url);
};

export const FullWidthVideoCard: React.FC<FullWidthVideoCardProps> = ({
  item,
  onSave,
  onLike,
  onDismiss,
}) => {
  const { isPremium } = useUserProfile();
  const { updateEngagement, getState, isLoading, initializeStates } = useEngagementState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [progressTracked, setProgressTracked] = useState<Set<number>>(new Set());

  // Initialize engagement state for this drop
  useEffect(() => {
    initializeStates([item.id.toString()]);
  }, [item.id, initializeStates]);

  // Get current engagement state
  const engagementState = getState(item.id.toString());
  const loadingState = isLoading(item.id.toString());

  const videoId = extractVideoId(item.url, item.youtube_video_id);
  const isValidYouTube = isYouTubeUrl(item.url) && videoId;
  
  // If not premium or not YouTube, don't render this component
  if (!isPremium || !isValidYouTube) {
    return null;
  }

  // Load YouTube API
  useEffect(() => {
    if (!isPlaying) return;

    const loadYouTubeAPI = () => {
      if (window.YT) {
        initializePlayer();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    };

    const initializePlayer = () => {
      if (!playerRef.current || !window.YT) return;

      const ytPlayer = new window.YT.Player(playerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          autoplay: 1,
        },
        events: {
          onReady: () => {
            trackVideoPlay({ drop_id: item.id, content_id: item.id, percent_played: 0 });
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              startProgressTracking(ytPlayer);
            } else if (event.data === window.YT?.PlayerState.PAUSED) {
              stopProgressTracking();
              trackVideoPause({ drop_id: item.id, content_id: item.id, percent_played: getCurrentProgress(ytPlayer) });
            } else if (event.data === window.YT?.PlayerState.ENDED) {
              stopProgressTracking();
              trackVideoComplete({ drop_id: item.id, content_id: item.id });
            }
          },
          onError: () => {
            console.error('YouTube player error');
          },
        },
      });

      setPlayer(ytPlayer);
    };

    loadYouTubeAPI();

    return () => {
      stopProgressTracking();
    };
  }, [isPlaying, videoId, item.id]);

  const getCurrentProgress = (ytPlayer: any): number => {
    if (!ytPlayer || !ytPlayer.getCurrentTime || !ytPlayer.getDuration) return 0;
    const currentTime = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration();
    return Math.floor((currentTime / duration) * 100);
  };

  const startProgressTracking = (ytPlayer: any) => {
    stopProgressTracking(); // Clear any existing interval

    progressIntervalRef.current = setInterval(() => {
      const percent = getCurrentProgress(ytPlayer);
      
      // Track 25%, 50%, 75% progress
      const quartiles = [25, 50, 75];
      quartiles.forEach(quartile => {
        if (percent >= quartile && !progressTracked.has(quartile)) {
          setProgressTracked(prev => new Set([...prev, quartile]));
          trackVideoPlay({ drop_id: item.id, content_id: item.id, percent_played: quartile });
        }
      });
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handleEngagementAction = async (action: "save"|"dismiss"|"like"|"dislike") => {
    const success = await updateEngagement(item.id.toString(), action);
    if (success) {
      // Call legacy handlers if provided
      switch (action) {
        case 'save':
          onSave?.(item.id);
          break;
        case 'like':
          onLike?.(item.id);
          break;
        case 'dismiss':
          onDismiss?.(item.id);
          break;
      }
    }
  };

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  const handleExternalLink = () => {
    window.open(item.url, '_blank');
  };

  const thumbnailUrl = item.youtube_thumbnail_url || 
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <TooltipProvider>
      <Card className="w-full overflow-hidden">
        <div className="relative">
          {/* Premium badge */}
          <Badge 
            variant="outline" 
            className="absolute top-3 left-3 z-10 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-none"
          >
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
          
          {/* Video container */}
          <div className="w-full aspect-video bg-black relative">
            {!isPlaying ? (
              // Thumbnail with play overlay
              <div className="relative w-full h-full group cursor-pointer" onClick={handlePlayClick}>
                <img
                  src={thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                  }}
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />
                
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    size="lg"
                    className="h-16 w-16 rounded-full bg-white/90 hover:bg-white hover:scale-110 transition-all duration-200"
                    aria-label="Play video"
                  >
                    <Play className="h-8 w-8 text-black ml-1" fill="currentColor" />
                  </Button>
                </div>
              </div>
            ) : (
              // YouTube iframe
              <div ref={playerRef} className="w-full h-full" />
            )}
          </div>
        </div>
        
        <CardContent className="p-6">
          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-3 leading-tight line-clamp-2">
            {item.title}
          </h2>
          
          {/* Meta info */}
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <span>📺</span>
            <span className="truncate">{item.source || 'YouTube'}</span>
            <span>•</span>
            <time className="whitespace-nowrap">
              {item.published_at ? new Date(item.published_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              }) : 'Recent'}
            </time>
          </div>
          
          {/* Summary */}
          {item.summary && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {item.summary}
            </p>
          )}
          
          {/* Topic tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {/* L1 Topic */}
            {item.l1_topic && (
              <Badge variant="tag-l1" className="text-xs">
                {item.l1_topic}
              </Badge>
            )}
            
            {/* L2 Topic */}
            {item.l2_topic && (
              <Badge variant="tag-l2" className="text-xs">
                {item.l2_topic}
              </Badge>
            )}
            
            {/* L3 Tags */}
            {item.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="tag-l3" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEngagementAction("like")}
                      disabled={loadingState}
                      className={`flex items-center gap-2 ${engagementState.isLiked ? 'bg-rose-50 border-rose-200 text-rose-700' : ''}`}
                      aria-pressed={engagementState.isLiked}
                    >
                      <Heart className={`h-4 w-4 ${engagementState.isLiked ? 'fill-current' : ''}`} />
                      {engagementState.isLiked ? 'Liked' : 'Like'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{engagementState.isLiked ? 'Unlike this video' : 'Like this video'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Hide Save button if item is liked (auto-saved) */}
              {!engagementState.isLiked && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEngagementAction("save")}
                        disabled={loadingState}
                        className={`flex items-center gap-2 ${engagementState.isSaved ? 'bg-primary/10 border-primary/20 text-primary' : ''}`}
                        aria-pressed={engagementState.isSaved}
                      >
                        <Bookmark className={`h-4 w-4 ${engagementState.isSaved ? 'fill-current' : ''}`} />
                        {engagementState.isSaved ? 'Saved' : 'Save'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{engagementState.isSaved ? 'Remove from saved' : 'Save for later'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEngagementAction("dislike")}
                      disabled={loadingState}
                      className={`flex items-center gap-2 ${engagementState.isDisliked ? 'bg-slate-50 border-slate-200 text-slate-700' : ''}`}
                      aria-pressed={engagementState.isDisliked}
                    >
                      <ThumbsDown className={`h-4 w-4 ${engagementState.isDisliked ? 'fill-current' : ''}`} />
                      {engagementState.isDisliked ? 'Disliked' : 'Dislike'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{engagementState.isDisliked ? 'Remove dislike' : 'Dislike this video'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEngagementAction("dismiss")}
                      disabled={loadingState}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Dismiss
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hide this video</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExternalLink}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open on YouTube</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};