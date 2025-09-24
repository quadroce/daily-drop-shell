import { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, pageview, identify, initializeAnalytics, setUserProperties, setUserId } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';

type AnalyticsProviderProps = {
  children: ReactNode;
};

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  // Initialize analytics on mount
  useEffect(() => {
    initializeAnalytics();
    initGA(user?.id);
  }, []);

  useEffect(() => {
    if (user?.id) {
      // Set user ID for GA4
      setUserId(user.id);
      identify(user.id);
      
      // Set user properties if profile is available
      if (profile) {
        const userProps: Record<string, any> = {};
        
        if (profile.subscription_tier) {
          userProps.subscription_tier = profile.subscription_tier;
        }
        
        // Note: Language preferences now come from preferences table via selected_language_ids
        
        if (profile.youtube_embed_pref !== undefined) {
          userProps.youtube_embed_pref = profile.youtube_embed_pref;
        }
        
        // Set all user properties at once
        if (Object.keys(userProps).length > 0) {
          setUserProperties(userProps);
        }
      }
    }
  }, [user?.id, profile?.subscription_tier, profile?.youtube_embed_pref]);

  // Track page views on route changes
  useEffect(() => {
    pageview(location.pathname + location.search, document.title);
  }, [location.pathname, location.search]);

  return <>{children}</>;
}