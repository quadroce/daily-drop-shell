import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { useStickyCTA } from "@/hooks/useStickyCTA";

export const StickyCtaBar = () => {
  const showStickyCTA = useStickyCTA(600);
  const [dismissed, setDismissed] = useState(false);

  if (!showStickyCTA || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50 animate-in slide-in-from-bottom duration-300">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <p className="text-sm md:text-base font-medium text-foreground">
            Enjoying these drops? Get your personalized feed.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="rounded-xl" asChild>
              <Link to="/auth">
                Sign up free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="rounded-xl"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
