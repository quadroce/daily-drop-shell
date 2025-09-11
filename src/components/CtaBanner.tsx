import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export type CtaBannerProps = {
  headline: string;
  primaryLabel: string;
  onPrimaryClick?: () => void;
  href?: string;
  variant?: "signup" | "upgrade";
};

export const CtaBanner = ({ 
  headline, 
  primaryLabel, 
  onPrimaryClick, 
  href = "/auth", 
  variant = "signup" 
}: CtaBannerProps) => {
  const bgClass = variant === "upgrade" 
    ? "bg-gradient-to-r from-primary/10 to-secondary/10" 
    : "bg-gradient-to-r from-muted/50 to-background";

  return (
    <section className={`py-12 px-4 ${bgClass}`}>
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold mb-4 text-foreground">
          {headline}
        </h2>
        {href ? (
          <Link to={href}>
            <Button size="lg" variant={variant === "upgrade" ? "default" : "secondary"}>
              {primaryLabel}
            </Button>
          </Link>
        ) : (
          <Button 
            size="lg" 
            variant={variant === "upgrade" ? "default" : "secondary"}
            onClick={onPrimaryClick}
          >
            {primaryLabel}
          </Button>
        )}
      </div>
    </section>
  );
};