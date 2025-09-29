import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight, Archive } from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";

export type ArchiveNavProps = {
  slug: string;
  selectedDate?: string;
  availableDates: string[];
  onDateChange?: (date: string) => void;
};

export const ArchiveNav = ({ slug, selectedDate, availableDates }: ArchiveNavProps) => {
  const currentDate = selectedDate ? parseISO(selectedDate) : new Date();
  const currentIndex = availableDates.indexOf(selectedDate || "");
  
  const prevDate = currentIndex < availableDates.length - 1 ? availableDates[currentIndex + 1] : null;
  const nextDate = currentIndex > 0 ? availableDates[currentIndex - 1] : null;

  const availableDateObjects = availableDates.map(date => parseISO(date));

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateString = format(date, 'yyyy-MM-dd');
    if (availableDates.includes(dateString)) {
      // Navigate to the daily archive page for that date
      window.location.href = `/topics/${slug}/${dateString}`;
    }
  };

  return (
    <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title and date info */}
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Archive</h2>
              {selectedDate && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    {format(currentDate, 'MMM d, yyyy')}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Navigation controls */}
          <div className="flex items-center gap-2">
            {/* Previous Date */}
            {prevDate && (
              <Button asChild variant="outline" size="sm" className="hidden sm:flex">
                <Link to={`/topics/${slug}/${prevDate}`}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden md:inline">
                    {format(parseISO(prevDate), 'MMM d')}
                  </span>
                </Link>
              </Button>
            )}

            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {selectedDate ? format(currentDate, 'MMM d, yyyy') : 'Select date'}
                  </span>
                  <span className="sm:hidden">Date</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate ? currentDate : undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) => !availableDateObjects.some(d => 
                    d.toDateString() === date.toDateString()
                  )}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Next Date */}
            {nextDate && (
              <Button asChild variant="outline" size="sm" className="hidden sm:flex">
                <Link to={`/topics/${slug}/${nextDate}`}>
                  <span className="hidden md:inline">
                    {format(parseISO(nextDate), 'MMM d')}
                  </span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}

            {/* Archive Overview Link */}
            <Button asChild variant="outline" size="sm">
              <Link to={`/topics/${slug}/archive`}>
                <Archive className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">All Archive</span>
                <span className="sm:hidden">All</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile navigation for dates */}
        {(prevDate || nextDate) && (
          <div className="flex sm:hidden items-center justify-between mt-3 pt-3 border-t border-border/50">
            {prevDate ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/topics/${slug}/${prevDate}`} className="flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-xs">
                    {format(parseISO(prevDate), 'MMM d')}
                  </span>
                </Link>
              </Button>
            ) : (
              <div /> 
            )}
            
            {nextDate ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/topics/${slug}/${nextDate}`} className="flex items-center gap-2">
                  <span className="text-xs">
                    {format(parseISO(nextDate), 'MMM d')}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>
    </div>
  );
};