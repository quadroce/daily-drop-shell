import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { useEffect, useState } from "react";

interface SignupPromoCardProps {
  utmSource?: string;
  utmCampaign?: string;
  position?: number;
  className?: string;
}

export const SignupPromoCard = ({
  utmSource = 'topics',
  utmCampaign = 'grid_card',
  position = 0,
  className = ''
}: SignupPromoCardProps) => {
  const { track } = useAnalytics();
  const location = useLocation();
  const [hasTrackedShow, setHasTrackedShow] = useState(false);

  useEffect(() => {
    if (!hasTrackedShow) {
      track('cta_shown', {
        placement: 'grid_card',
        utm_source: utmSource,
        utm_campaign: utmCampaign,
        position,
        page: location.pathname
      });
      setHasTrackedShow(true);
    }
  }, [hasTrackedShow, track, utmSource, utmCampaign, position, location.pathname]);

  const handleClick = () => {
    track('cta_clicked', {
      placement: 'grid_card',
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      position,
      page: location.pathname
    });
  };

  const signupUrl = `/auth?next=${encodeURIComponent(location.pathname)}&utm_source=${utmSource}&utm_campaign=${utmCampaign}`;

  return (
    <Card className={`overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20 ${className}`}>
      <CardContent className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="mb-6 p-4 bg-primary/10 rounded-full">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-3">
          Unlock your personalized DailyDrops
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Get curated content tailored to your interests. Join thousands of professionals staying ahead.
        </p>
        <Button
          size="lg"
          className="rounded-xl"
          asChild
          onClick={handleClick}
        >
          <Link to={signupUrl}>
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
