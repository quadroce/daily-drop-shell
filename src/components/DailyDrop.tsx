import { FeedCard, FeedCardProps } from "./FeedCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ExternalLink } from "lucide-react";

export type DailyDropProps = {
  items: FeedCardProps[];
  constraints: {
    minYoutube: number;
    maxPerSource: number;
    maxSponsored: number;
  };
  user?: { isLoggedIn: boolean; isPremium: boolean };
  onEngage?: (e: { itemId: string; action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play" }) => void;
  hideConstraintAlert?: boolean;
};

export const DailyDrop = ({ items, constraints, user, onEngage, hideConstraintAlert = false }: DailyDropProps) => {
  // Validate constraints
  const videoCount = items.filter(item => item.type === "video").length;
  const sourceCount = new Map<string, number>();
  items.forEach(item => {
    const count = sourceCount.get(item.source.name) || 0;
    sourceCount.set(item.source.name, count + 1);
  });

  const hasConstraintViolations = 
    videoCount < constraints.minYoutube || 
    Array.from(sourceCount.values()).some(count => count > constraints.maxPerSource);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {hasConstraintViolations && !hideConstraintAlert && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            This daily drop may not meet all quality constraints. 
            Videos: {videoCount}/{constraints.minYoutube} minimum.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 bg-background hover:shadow-md transition-shadow">
            <div className="flex gap-4">
              {/* Image */}
              <div className="flex-shrink-0 w-20 h-20 bg-muted rounded-md overflow-hidden">
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 
                    className="font-semibold text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors text-base leading-tight"
                    onClick={() => window.open(item.href, "_blank", "noopener,noreferrer")}
                  >
                    {item.title}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  <span className="truncate">{item.source.name}</span>
                  <span>•</span>
                  <time dateTime={item.publishedAt} className="whitespace-nowrap">
                    {new Date(item.publishedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </time>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {item.summary}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {item.l1Topic && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {item.l1Topic}
                      </span>
                    )}
                    {item.l2Topic && (
                      <span className="text-xs bg-secondary/10 text-secondary-foreground px-2 py-1 rounded">
                        {item.l2Topic}
                      </span>
                    )}
                    {item.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <a 
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 p-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No content available for this date.</p>
        </div>
      )}
    </div>
  );
};