import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

export function useEngagement() {
  const fired50 = useRef(false);
  const fired90 = useRef(false);
  const start = useRef<number>(Date.now());
  const fired10s = useRef(false);
  const fired30s = useRef(false);
  const fired60s = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      
      if (scrolled >= 0.5 && !fired50.current) { 
        fired50.current = true; 
        track('scroll_50', {}); 
      }
      
      if (scrolled >= 0.9 && !fired90.current) { 
        fired90.current = true; 
        track('scroll_90', {}); 
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // Dwell time tracking
    const t10 = setTimeout(() => {
      if (!fired10s.current) {
        fired10s.current = true;
        track('dwell_time', { seconds: 10 });
      }
    }, 10000);

    const t30 = setTimeout(() => {
      if (!fired30s.current) {
        fired30s.current = true;
        track('dwell_time', { seconds: 30 });
      }
    }, 30000);

    const t60 = setTimeout(() => {
      if (!fired60s.current) {
        fired60s.current = true;
        track('dwell_time', { seconds: 60 });
      }
    }, 60000);

    return () => {
      window.removeEventListener('scroll', onScroll);
      
      const total = Math.round((Date.now() - start.current) / 1000);
      if (total >= 5) { // Only track if user stayed at least 5 seconds
        track('dwell_time_total', { seconds: total });
      }
      
      clearTimeout(t10); 
      clearTimeout(t30); 
      clearTimeout(t60);
    };
  }, []);

  return {
    trackEngagement: (action: string, params: Record<string, any> = {}) => {
      track(action, params);
    }
  };
}