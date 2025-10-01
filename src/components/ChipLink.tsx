import { Link, useLocation } from "react-router-dom";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useAnalytics } from "@/lib/analytics";

export type ChipLinkProps = {
  to: string;
  children: React.ReactNode;
  className?: string;
  variant?: BadgeProps["variant"];
  level?: 1 | 2 | 3;
  position?: number;
};

export const ChipLink = ({
  to,
  children,
  className,
  variant = "secondary",
  level,
  position
}: ChipLinkProps) => {
  const { track } = useAnalytics();
  const location = useLocation();

  const handleClick = () => {
    const slug = to.split('/topics/')[1]?.split('?')[0] || to;

    track('tag_clicked', {
      slug,
      level: level || (variant === 'tag-l1' ? 1 : variant === 'tag-l2' ? 2 : 3),
      page: location.pathname,
      position: position || 0
    });
  };

  return (
    <Link to={to} onClick={handleClick}>
      <Badge
        variant={variant}
        className={`hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${className}`}
        role="link"
        aria-label={`View topic: ${children}`}
      >
        {children}
      </Badge>
    </Link>
  );
};