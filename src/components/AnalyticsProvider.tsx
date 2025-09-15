import { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, pageview, identify, initializeAnalytics, track } from '@/lib/analytics';
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
      identify(user.id);
      
      // Set subscription tier as user property if profile is available
      if (profile?.subscription_tier) {
        track('set_user_property', { 
          subscription_tier: profile.subscription_tier 
        });
      }
    }
  }, [user?.id, profile?.subscription_tier]);

  // Track page views on route changes
  useEffect(() => {
    pageview(location.pathname + location.search, document.title);
  }, [location.pathname, location.search]);

  return <>{children}</>;
}