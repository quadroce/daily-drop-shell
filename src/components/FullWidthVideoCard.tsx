import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChipLink } from "@/components/ChipLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Heart, Bookmark, X, ThumbsDown, ExternalLink, Play, Flag, Crown } from "lucide-react";
import { getYouTubeThumbnailFromUrl } from "@/lib/youtube";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { useFeedback, createDebouncedOpenTracker } from "@/lib/feedback";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

interface FullWidthVideoCardProps {
  item: {
    id: string | number;
    title: string;
    source?: string;
    source_name?: string;
    published_at?: string;
    youtube_video_id?: string;
    url: string;
    image_url?: string;
    tags?: string[];
    summary?: string;
    l1_topic?: string;
    l2_topic?: string;
    reason_for_ranking?: string;
  };
  isPremium: boolean;
  onSave?: (id: string | number) => void;
  onLike?: (id: string | number) => void;
  onDismiss?: (id: string | number) => void;
  onReport?: (id: string | number) => void;
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

export function FullWidthVideoCard({ 
  item, 
  isPremium, 
  onSave, 
  onLike, 
  onDismiss, 
  onReport 
}: FullWidthVideoCardProps) {
  const { getTopicSlug, isLoading: topicsLoading } = useTopicsMap();
  const { sendFeedback } = useFeedback();
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const [quarterProgressTracked, setQuarterProgressTracked] = useState<Set<number>>(new Set());
  const playerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create debounced open tracker for this component instance
  const debouncedOpenTracker = createDebouncedOpenTracker(2000);
  
  const videoId = extractVideoId(item.url, item.youtube_video_id);
  const isValidYouTube = isYouTubeUrl(item.url) && videoId;
  
  // If not premium or not YouTube, don't render this component
  if (!isPremium || !isValidYouTube) {
    return null;
  }
  
  const thumbnailUrl = item.image_url || getYouTubeThumbnailFromUrl(item.url);
  const sourceName = item.source || item.source_name || 'Unknown Source';
  
  // GA4 Analytics functions
  const trackVideoEvent = useCallback((eventName: string, parameters: Record<string, any> = {}) => {
    if (window.gtag) {
      window.gtag('event', eventName, {
        video_id: videoId,
        source: sourceName,
        content_id: item.id,
        ...parameters
      });
    }
  }, [videoId, sourceName, item.id]);
  
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
          autoplay: 1
        },
        events: {
          onReady: () => {
            trackVideoEvent('video_play');
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              startProgressTracking(ytPlayer);
            } else if (event.data === window.YT?.PlayerState.PAUSED) {
              stopProgressTracking();
              trackVideoEvent('video_pause');
            } else if (event.data === window.YT?.PlayerState.ENDED) {
              stopProgressTracking();
              trackVideoEvent('video_progress', { percent: 100 });
            }
          },
          onError: () => {
            setVideoError(true);
          }
        }
      });
      
      setPlayer(ytPlayer);
    };
    
    loadYouTubeAPI();
    
    return () => {
      stopProgressTracking();
    };
  }, [isPlaying, videoId, trackVideoEvent]);
  
  const startProgressTracking = useCallback((ytPlayer: any) => {
    stopProgressTracking(); // Clear any existing interval
    
    intervalRef.current = setInterval(() => {
      if (!ytPlayer || !ytPlayer.getCurrentTime || !ytPlayer.getDuration) return;
      
      const currentTime = ytPlayer.getCurrentTime();
      const duration = ytPlayer.getDuration();
      const percent = Math.floor((currentTime / duration) * 100);
      
      // Track quartiles
      const quartiles = [25, 50, 75];
      quartiles.forEach(quartile => {
        if (percent >= quartile && !quarterProgressTracked.has(quartile)) {
          setQuarterProgressTracked(prev => new Set([...prev, quartile]));
          trackVideoEvent('video_progress', { percent: quartile });
        }
      });
    }, 1000);
  }, [quarterProgressTracked, trackVideoEvent]);
  
  const stopProgressTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  const handlePlayClick = () => {
    setIsPlaying(true);
  };
  
  const handleExternalLink = () => {
    // Track the open action with feedback system
    sendFeedback('open', Number(item.id));
    debouncedOpenTracker(Number(item.id));
    window.open(item.url, '_blank');
  };
  
  // If video error occurred, don't render
  if (videoError) {
    return null;
  }
  
  return (
    <TooltipProvider>
      <Card className="w-full rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        {/* Premium badge */}
        <div className="relative">
          <Badge 
            variant="outline" 
            className="absolute top-3 left-3 z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none shadow-lg"
          >
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
          
          {/* Video container */}
          <div className="w-full aspect-video overflow-hidden rounded-t-2xl bg-black relative">
            {!isPlaying ? (
              // Thumbnail with play overlay
              <div className="relative w-full h-full group cursor-pointer" onClick={handlePlayClick}>
                <img
                  src={thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop';
                  }}
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />
                
                {/* Title overlay on thumbnail */}
                <div className="absolute top-4 left-4 right-16">
                  <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2 drop-shadow-lg">
                    {item.title}
                  </h3>
                </div>
                
                {/* Play button */}
                <div className="absolute inset-0 grid place-items-center">
                  <Button
                    size="lg"
                    className="h-16 w-16 rounded-full bg-white/90 hover:bg-white hover:scale-110 transition-all duration-200 shadow-2xl"
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
          
          {/* Content section */}
          <div className="p-6">
            {/* Title (for accessibility and SEO) */}
            <h2 className="text-xl font-bold text-foreground mb-3 leading-tight">
              {item.title}
            </h2>
            
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <span>📺</span>
              <span className="truncate">{sourceName}</span>
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
            
            {/* Chips and Tags */}
            <div className="space-y-3">
              {/* Ranking reason chip */}
              {item.reason_for_ranking && (
                <div>
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary/80 border-primary/20">
                    {item.reason_for_ranking}
                  </Badge>
                </div>
              )}
              
              {/* Topic tags */}
              <div className="flex flex-wrap gap-2">
                {/* L1 Topic (Blue) */}
                {item.l1_topic && (
                  topicsLoading || !getTopicSlug(item.l1_topic) ? (
                    <Badge variant="tag-l1" className="text-xs">
                      {item.l1_topic}
                    </Badge>
                  ) : (
                    <ChipLink 
                      to={`/topics/${getTopicSlug(item.l1_topic)}`}
                      variant="tag-l1"
                      className="text-xs"
                    >
                      {item.l1_topic}
                    </ChipLink>
                  )
                )}
                
                {/* L2 Topic (Green) */}
                {item.l2_topic && (
                  topicsLoading || !getTopicSlug(item.l2_topic) ? (
                    <Badge variant="tag-l2" className="text-xs">
                      {item.l2_topic}
                    </Badge>
                  ) : (
                    <ChipLink 
                      to={`/topics/${getTopicSlug(item.l2_topic)}`}
                      variant="tag-l2"
                      className="text-xs"
                    >
                      {item.l2_topic}
                    </ChipLink>
                  )
                )}
                
                {/* L3 Tags (Purple) */}
                {item.tags?.slice(0, 3).map((tag) => (
                  topicsLoading || !getTopicSlug(tag) ? (
                    <Badge key={tag} variant="tag-l3" className="text-xs">
                      {tag}
                    </Badge>
                  ) : (
                    <ChipLink 
                      key={tag}
                      to={`/topics/${getTopicSlug(tag)}`}
                      variant="tag-l3"
                      className="text-xs"
                    >
                      {tag}
                    </ChipLink>
                  )
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {onLike && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await sendFeedback('like', Number(item.id));
                        onLike(item.id);
                      }}>
                        <Heart className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Like</TooltipContent>
                  </Tooltip>
                )}
                
                {onSave && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await sendFeedback('save', Number(item.id));
                        onSave(item.id);
                      }}>
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save</TooltipContent>
                  </Tooltip>
                )}
                
                {onDismiss && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await sendFeedback('dismiss', Number(item.id));
                        onDismiss(item.id);
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Dismiss</TooltipContent>
                  </Tooltip>
                )}
                
                {onReport && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onReport(item.id)}>
                        <Flag className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Report</TooltipContent>
                  </Tooltip>
                )}
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleExternalLink}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open on YouTube</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}