import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check } from "lucide-react";
import { Link } from "react-router-dom";

export type PremiumSidebarProps = {
  title: string;
  bullets?: string[];
  upgradeHref: string;
};

export const PremiumSidebar = ({ 
  title, 
  bullets = [
    "Unlimited archive access",
    "Inline YouTube videos", 
    "Ad-free experience",
    "Premium newsletters"
  ], 
  upgradeHref 
}: PremiumSidebarProps) => {
  return (
    <div className="sticky top-6">
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {bullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          
          <Link to={upgradeHref} className="block">
            <Button className="w-full" size="lg">
              Upgrade to Premium
            </Button>
          </Link>
          
          <p className="text-xs text-muted-foreground text-center">
            Cancel anytime. 30-day money-back guarantee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};