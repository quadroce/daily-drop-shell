import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useAnalytics } from "@/lib/analytics";

interface SignupCtaProps {
  topicSlug?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const SignupCta = ({ 
  topicSlug,
  variant = "default", 
  size = "default",
  className = ""
}: SignupCtaProps) => {
  const { track } = useAnalytics();
  const location = useLocation();

  const handleSignupClick = () => {
    track('signup_from_topic_page', { 
      topic_slug: topicSlug,
      location: location.pathname
    });
  };

  const currentPath = location.pathname + location.search;

  return (
    <Button 
      asChild
      variant={variant}
      size={size}
      className={className}
      onClick={handleSignupClick}
    >
      <Link to={`/auth?redirect=${encodeURIComponent(currentPath)}`}>
        Get the full Drop free every morning
      </Link>
    </Button>
  );
};