import { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, pageview, identify, initializeAnalytics } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

type AnalyticsProviderProps = {
  children: ReactNode;
};

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const location = useLocation();
  const { user } = useAuth();

  // Initialize analytics on mount
  useEffect(() => {
    initializeAnalytics();
    initGA(user?.id);
  }, []);

  // Track user identification changes
  useEffect(() => {
    if (user?.id) {
      identify(user.id);
    }
  }, [user?.id]);

  // Track page views on route changes
  useEffect(() => {
    pageview(location.pathname + location.search, document.title);
  }, [location.pathname, location.search]);

  return <>{children}</>;
}