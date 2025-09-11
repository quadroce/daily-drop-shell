import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/lib/analytics";

interface QuickSearchProps {
  placeholder?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "minimal";
}

export const QuickSearch = ({ 
  placeholder = "Quick search...",
  className,
  size = "default",
  variant = "default"
}: QuickSearchProps) => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { track } = useAnalytics();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      
      track('search_performed', {
        query: query.trim(),
        source: 'quick_search'
      });
      
      setQuery("");
    }
  };

  const sizeClasses = {
    sm: "h-8 text-sm",
    default: "h-10",
    lg: "h-12 text-lg"
  };

  if (variant === "minimal") {
    return (
      <form onSubmit={handleSubmit} className={cn("relative max-w-md", className)}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn("pl-10 pr-4", sizeClasses[size])}
          />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2 max-w-md", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn("pl-10", sizeClasses[size])}
        />
      </div>
      <Button 
        type="submit" 
        disabled={!query.trim()}
        className={cn(sizeClasses[size])}
      >
        Search
      </Button>
    </form>
  );
};