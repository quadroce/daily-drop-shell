import { FeedCard, FeedCardProps } from "./FeedCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export type DailyDropProps = {
  items: FeedCardProps[];
  constraints: {
    minYoutube: number;
    maxPerSource: number;
    maxSponsored: number;
  };
  user?: { isLoggedIn: boolean; isPremium: boolean };
  onEngage?: (e: { itemId: string; action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play" }) => void;
};

export const DailyDrop = ({ items, constraints, user, onEngage }: DailyDropProps) => {
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
      {hasConstraintViolations && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            This daily drop may not meet all quality constraints. 
            Videos: {videoCount}/{constraints.minYoutube} minimum.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {items.map((item) => (
          <FeedCard 
            key={item.id} 
            {...item} 
            user={user}
            onEngage={onEngage}
          />
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