import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

declare global { 
  interface Window { 
    YT?: any; 
    onYouTubeIframeAPIReady?: () => void; 
  } 
}

type Props = {
  videoId: string;
  contentId: string;
  className?: string;
  isPremium?: boolean;
  lazy?: boolean;
};

export default function YouTubePlayer({ videoId, contentId, className, isPremium = false, lazy = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const milestones = useRef(new Set<number>()); // 25,50,75,100
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Load for all users now, not just premium
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      if (!ref.current) return;
      
      playerRef.current = new window.YT.Player(ref.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com', // Privacy-enhanced mode
        events: {
          onStateChange: (e: any) => {
            // Track video events
            switch (e.data) {
              case window.YT.PlayerState.PLAYING:
                track('video_play', { 
                  drop_id: contentId, 
                  content_id: contentId
                });
                break;
              case window.YT.PlayerState.PAUSED:
                track('video_pause', { 
                  drop_id: contentId, 
                  content_id: contentId
                });
                break;
              case window.YT.PlayerState.ENDED:
                track('video_complete', { 
                  drop_id: contentId, 
                  content_id: contentId
                });
                break;
            }
          },
          onReady: () => {
            console.log('YouTube player ready for', videoId);
          }
        },
        playerVars: { 
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          iv_load_policy: 3, // Hide annotations
          fs: 1, // Allow fullscreen
          cc_load_policy: 0, // Hide captions by default
          autoplay: 0, // No autoplay
          origin: window.location.origin // Required for iframe API
        }
      });

      // Set up progress tracking
      const timer = setInterval(() => {
        if (!playerRef.current || typeof playerRef.current.getDuration !== 'function') return;
        
        try {
          const dur = playerRef.current.getDuration?.() || 0;
          const cur = playerRef.current.getCurrentTime?.() || 0;
          
          if (dur > 0) {
            const pct = Math.floor((cur / dur) * 100);
            [25, 50, 75, 100].forEach(milestone => {
              if (pct >= milestone && !milestones.current.has(milestone)) {
                milestones.current.add(milestone);
                track('video_progress', { 
                  content_id: contentId, 
                  video_id: videoId, 
                  percent: milestone,
                  platform: 'youtube_embedded'
                });
                
                // Track quartiles separately for GA4
                if (milestone === 25) {
                  track('video_quartile_1', { content_id: contentId, video_id: videoId });
                } else if (milestone === 50) {
                  track('video_quartile_2', { content_id: contentId, video_id: videoId });
                } else if (milestone === 75) {
                  track('video_quartile_3', { content_id: contentId, video_id: videoId });
                } else if (milestone === 100) {
                  track('video_quartile_4', { content_id: contentId, video_id: videoId });
                }
              }
            });
          }
        } catch (error) {
          // Ignore errors from YouTube API calls
        }
      }, 1000);

      return () => {
        clearInterval(timer);
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      };
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, [videoId, contentId]);

  return <div ref={ref} className={className} />;
}