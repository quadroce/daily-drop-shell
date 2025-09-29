import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Lock, ExternalLink, Calendar } from "lucide-react";
import { FeedCardProps } from "./FeedCard";
import { ChipLink } from "./ChipLink";
import { useTopicsMap } from "@/hooks/useTopicsMap";
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
  const { getTopicSlug } = useTopicsMap();

  return (
    <div className="space-y-8">
      {days.map(({ date, items }) => {
        const isLocked = premiumLocked && items.length === 0;
        
        return (
          <Card key={date} className={`transition-all hover:shadow-sm ${isLocked ? "opacity-60" : "bg-card hover:bg-card-hover"}`}>
            {/* Date Header */}
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <Link 
                  to={`/topics/${slug}/${date}`}
                  className="group flex items-center gap-3 hover:text-primary transition-colors"
                >
                  <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                  <div>
                    <h2 className="text-xl font-bold">
                      {format(parseISO(date), 'EEEE, MMMM d')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(date), 'yyyy')}
                    </p>
                  </div>
                </Link>
                
                <div className="flex items-center gap-2">
                  {!isLocked && (
                    <Badge variant="outline" className="text-xs">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </Badge>
                  )}
                  {isLocked && (
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                        Premium Only
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6">
              {isLocked ? (
                <div className="text-center py-8">
                  <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">Premium Content</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                    Archives older than 90 days require Premium access to unlock the full content history.
                  </p>
                  <Button asChild size="sm">
                    <Link to="/pricing">
                      Upgrade to Premium
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.slice(0, 6).map((item) => (
                    <Card key={item.id} className="group overflow-hidden hover:shadow-md transition-all bg-background border">
                      <div className="aspect-video relative overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted via-muted to-muted-foreground/10 flex items-center justify-center">
                            <ExternalLink className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="truncate">{item.source.name}</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Show topic tags if available from the main topic */}
                              <ChipLink 
                                to={`/topics/${slug}`} 
                                variant="tag-l1" 
                                className="text-xs py-0.5 px-2"
                              >
                                {slug}
                              </ChipLink>
                            </div>
                            
                            <a 
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors group"
                              aria-label="Open article"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Show more button for large lists */}
              {!isLocked && items.length > 6 && (
                <div className="mt-6 pt-4 border-t border-border/50 text-center">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/topics/${slug}/${date}`}>
                      View all {items.length} items from this day
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      
      {days.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Archive Available</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            No archived content found for this topic. Check back later as we continuously curate new content.
          </p>
        </div>
      )}
    </div>
  );
};