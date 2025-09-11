import { useState } from "react";
import { Calendar, Filter, Tag, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SearchFiltersType } from "@/lib/api/search";

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onChange: (filters: Partial<SearchFiltersType>) => void;
  className?: string;
}

const POPULAR_SOURCES = [
  "YouTube", "ArXiv", "Medium", "GitHub", "Hugging Face", "OpenAI", 
  "Google AI", "Microsoft", "Meta AI", "Anthropic", "DeepMind"
];

const POPULAR_TAGS = [
  "ai", "ml", "deep-learning", "nlp", "computer-vision", "robotics",
  "gpt", "llm", "transformers", "neural-networks", "pytorch", "tensorflow",
  "research", "paper", "tutorial", "code", "dataset", "model"
];

export const SearchFilters = ({ filters, onChange, className }: SearchFiltersProps) => {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const handleDateFromSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ dateFrom: format(date, "yyyy-MM-dd") });
      setDateFromOpen(false);
    }
  };

  const handleDateToSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ dateTo: format(date, "yyyy-MM-dd") });
      setDateToOpen(false);
    }
  };

  const activeFiltersCount = [filters.source, filters.tag, filters.dateFrom, filters.dateTo]
    .filter(Boolean).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter Header */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4" />
        <span className="font-medium">Filters</span>
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeFiltersCount} active
          </Badge>
        )}
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Source Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4" />
            Source
          </Label>
          <Select
            value={filters.source || ""}
            onValueChange={(value) => onChange({ source: value || undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any source" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
              {POPULAR_SOURCES.map(source => (
                <SelectItem key={source} value={source.toLowerCase()}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tag Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4" />
            Tag
          </Label>
          <Select
            value={filters.tag || ""}
            onValueChange={(value) => onChange({ tag: value || undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any tag" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-md z-50">
              {POPULAR_TAGS.map(tag => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date From Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            From Date
          </Label>
          <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(new Date(filters.dateFrom), "MMM dd, yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-background border shadow-md z-50" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                onSelect={handleDateFromSelect}
                disabled={(date) => date > new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            To Date
          </Label>
          <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateTo && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(new Date(filters.dateTo), "MMM dd, yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-background border shadow-md z-50" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                onSelect={handleDateToSelect}
                disabled={(date) => {
                  const today = new Date();
                  const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
                  return date > today || (fromDate && date < fromDate);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Quick Filter Tags */}
      <div className="space-y-2">
        <Label className="text-sm">Quick filters</Label>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TAGS.slice(0, 8).map(tag => (
            <Button
              key={tag}
              variant={filters.tag === tag ? "default" : "outline"}
              size="sm"
              onClick={() => onChange({ tag: filters.tag === tag ? undefined : tag })}
              className="text-xs"
            >
              {tag}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};