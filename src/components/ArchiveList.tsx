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
    items: Pick<FeedCardProps, "id"|"title"|"href"|"source"|"imageUrl">[];
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
                    <div key={item.id} className="flex items-start gap-3">
                      {/* Image */}
                      <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-md overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2 mb-1">
                          {item.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {item.source.name}
                        </p>
                      </div>
                      
                      {/* External Link Button */}
                      <a 
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
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