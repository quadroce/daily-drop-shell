import { Link } from "react-router-dom";
import { Badge, BadgeProps } from "@/components/ui/badge";

export type ChipLinkProps = {
  to: string;
  children: React.ReactNode;
  className?: string;
  variant?: BadgeProps["variant"];
};

export const ChipLink = ({ to, children, className, variant = "secondary" }: ChipLinkProps) => {
  return (
    <Link to={to}>
      <Badge 
        variant={variant}
        className={`hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${className}`}
      >
        {children}
      </Badge>
    </Link>
  );
};