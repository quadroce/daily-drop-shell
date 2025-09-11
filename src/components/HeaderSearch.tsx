import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/lib/analytics";

interface HeaderSearchProps {
  className?: string;
}

export const HeaderSearch = ({ className }: HeaderSearchProps) => {
  const [query, setQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { track } = useAnalytics();

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setQuery("");
      setIsExpanded(false);
      
      track('search_performed', {
        query: searchQuery.trim(),
        source: 'header'
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const toggleSearch = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery("");
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Desktop Version */}
      <div className="hidden md:flex items-center">
        {!isExpanded ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSearch}
            className="h-9 w-9"
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search articles..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-10 w-64"
                onBlur={() => {
                  if (!query) {
                    setTimeout(() => setIsExpanded(false), 150);
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Mobile Version */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/search')}
          className="h-9 w-9"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};