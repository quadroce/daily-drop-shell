import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface AdminTileProps {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  variant?: "default" | "highlight";
}

export function AdminTile({ to, icon: Icon, title, subtitle, variant = "default" }: AdminTileProps) {
  const isHighlight = variant === "highlight";
  
  return (
    <Link to={to} className="block">
      <Button 
        variant="outline" 
        className={`w-full justify-start gap-2 h-auto py-4 ${
          isHighlight 
            ? "text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20" 
            : ""
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <div className="text-left">
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </Button>
    </Link>
  );
}
