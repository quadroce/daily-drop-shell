import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export type ChipLinkProps = {
  to: string;
  children: React.ReactNode;
  className?: string;
};

export const ChipLink = ({ to, children, className }: ChipLinkProps) => {
  return (
    <Link to={to}>
      <Badge 
        variant="secondary" 
        className={`hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${className}`}
      >
        {children}
      </Badge>
    </Link>
  );
};