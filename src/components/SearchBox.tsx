import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  size?: "default" | "large";
  className?: string;
}

export const SearchBox = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  size = "default",
  className
}: SearchBoxProps) => {
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value);
  };

  const clearSearch = () => {
    onChange("");
    onSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className={cn(
        "relative flex items-center transition-all duration-200",
        size === "large" && "text-lg",
        focused && "ring-2 ring-primary ring-offset-2 rounded-lg"
      )}>
        <div className="absolute left-3 flex items-center pointer-events-none">
          <Search className={cn(
            "text-muted-foreground",
            size === "large" ? "w-5 h-5" : "w-4 h-4"
          )} />
        </div>
        
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-20 border-2 transition-colors",
            size === "large" && "h-12 text-lg",
            focused && "border-primary"
          )}
        />
        
        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          
          <Button
            type="submit"
            size={size === "large" ? "default" : "sm"}
            className={cn(
              "px-3",
              size === "large" && "h-8"
            )}
          >
            Search
          </Button>
        </div>
      </div>
    </form>
  );
};