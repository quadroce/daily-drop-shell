import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export const CTABannerCard = () => {
  return (
    <Card className="rounded-2xl shadow-md border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-40"></div>
      <CardContent className="p-8 md:p-10 flex flex-col items-center justify-center text-center relative min-h-[300px]">
        <Sparkles className="h-12 w-12 text-primary mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-3">
          Unlock your personalized DailyDrops
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Get curated content tailored to your interests. Join thousands of professionals staying ahead.
        </p>
        <Button size="lg" className="rounded-2xl px-8" asChild>
          <Link to="/auth">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
