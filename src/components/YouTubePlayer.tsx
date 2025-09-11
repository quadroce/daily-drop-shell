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
};

export default function YouTubePlayer({ videoId, contentId, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const milestones = useRef(new Set<number>()); // 25,50,75,100
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const initPlayer = () => {
      if (!ref.current) return;
      
      playerRef.current = new window.YT.Player(ref.current, {
        videoId,
        events: {
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              track('video_play', { content_id: contentId, video_id: videoId, percent: 0 });
            }
          }
        },
        playerVars: { 
          rel: 0,
          modestbranding: 1,
          showinfo: 0
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
                  percent: milestone 
                });
                if (milestone === 100) {
                  track('video_complete', { 
                    content_id: contentId, 
                    video_id: videoId 
                  });
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