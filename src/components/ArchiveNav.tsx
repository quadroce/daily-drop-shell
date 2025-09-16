import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO, addDays, subDays } from "date-fns";

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

  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">Archive</h1>
      </div>

      <div className="flex items-center gap-2">
        {prevDate && (
          <Link to={`/topics/${slug}/${prevDate}`}>
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {selectedDate ? format(currentDate, 'MMM d, yyyy') : 'Select date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={currentDate}
              disabled={(date) => !availableDateObjects.some(d => 
                d.toDateString() === date.toDateString()
              )}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {nextDate && (
          <Link to={`/topics/${slug}/${nextDate}`}>
            <Button variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}

        <Link to={`/topics/${slug}/archive`}>
          <Button variant="outline" className="ml-2">
            Archive
          </Button>
        </Link>
      </div>
    </div>
  );
};