import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useStickyCTA } from "@/hooks/useStickyCTA";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/lib/analytics";

interface SignupStickyBarProps {
  scrollThreshold?: number;
  utmSource?: string;
  utmCampaign?: string;
  text?: string;
  buttonText?: string;
}

const DISMISS_KEY = 'cta_sticky_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

export const SignupStickyBar = ({
  scrollThreshold = 400,
  utmSource = 'home',
  utmCampaign = 'sticky_bar',
  text = "Enjoying these drops? Get your personalized feed.",
  buttonText = "Sign up free"
}: SignupStickyBarProps) => {
  const showStickyCTA = useStickyCTA(scrollThreshold);
  const { user } = useAuth();
  const { track } = useAnalytics();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [hasTrackedShow, setHasTrackedShow] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const timestamp = parseInt(dismissedAt, 10);
      if (Date.now() - timestamp < DISMISS_DURATION) {
        setDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (showStickyCTA && !dismissed && !user && !hasTrackedShow) {
      track('cta_shown', {
        placement: 'sticky_bar',
        utm_source: utmSource,
        utm_campaign: utmCampaign,
        page: location.pathname
      });
      setHasTrackedShow(true);
    }
  }, [showStickyCTA, dismissed, user, hasTrackedShow, track, utmSource, utmCampaign, location.pathname]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
    track('cta_dismissed', {
      placement: 'sticky_bar',
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      page: location.pathname
    });
  };

  const handleClick = () => {
    track('cta_clicked', {
      placement: 'sticky_bar',
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      page: location.pathname
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && showStickyCTA && !dismissed && !user) {
      handleDismiss();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  if (!showStickyCTA || dismissed || user) return null;

  const signupUrl = `/auth?next=${encodeURIComponent(location.pathname)}&utm_source=${utmSource}&utm_campaign=${utmCampaign}`;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50 animate-in slide-in-from-bottom duration-300"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="banner"
      aria-label="Sign up call to action"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <p className="text-sm md:text-base font-medium text-foreground">
            {text}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-xl min-h-[44px] min-w-[44px]"
              asChild
              onClick={handleClick}
            >
              <Link to={signupUrl}>
                <span className="hidden sm:inline">{buttonText}</span>
                <span className="sm:hidden">Sign up</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl min-h-[44px] min-w-[44px]"
              onClick={handleDismiss}
              aria-label="Close sign up banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
