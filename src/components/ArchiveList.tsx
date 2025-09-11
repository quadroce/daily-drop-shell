import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Lock, ExternalLink } from "lucide-react";
import { FeedCardProps } from "./FeedCard";
import { format, parseISO } from "date-fns";

export type ArchiveListProps = {
  slug: string;
  days: {
    date: string;
    items: Pick<FeedCardProps, "id"|"title"|"href"|"source">[];
  }[];
  premiumLocked?: boolean;
};

export const ArchiveList = ({ slug, days, premiumLocked }: ArchiveListProps) => {
  return (
    <div className="space-y-6">
      {days.map(({ date, items }) => {
        const isLocked = premiumLocked && items.length === 0;
        
        return (
          <Card key={date} className={isLocked ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <Link 
                  to={`/topics/${slug}/${date}`}
                  className="text-lg font-semibold hover:text-primary"
                >
                  {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                </Link>
                {isLocked && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <Badge variant="outline">Premium</Badge>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLocked ? (
                <p className="text-muted-foreground text-sm">
                  Archives older than 90 days require Premium access.
                </p>
              ) : (
                <div className="space-y-3">
                  {items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm line-clamp-1 mb-1">
                          {item.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {item.source.name}
                        </p>
                      </div>
                      <a 
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <Link 
                      to={`/topics/${slug}/${date}`}
                      className="text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      View all {items.length} items →
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};