import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Play, Heart, Bookmark, X } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";

export type FeedCardProps = {
  id: string;
  type: "article" | "video";
  title: string;
  summary: string;
  imageUrl?: string;
  publishedAt: string;
  source: { name: string; url: string };
  tags: string[];
  href: string;
  youtubeId?: string;
  isPremium?: boolean;
};

type FeedCardComponentProps = FeedCardProps & {
  user?: { isLoggedIn: boolean; isPremium: boolean };
  onEngage?: (e: { itemId: string; action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play" }) => void;
};

export const FeedCard = ({ 
  id, 
  type, 
  title, 
  summary, 
  imageUrl, 
  publishedAt, 
  source, 
  tags, 
  href, 
  youtubeId, 
  isPremium, 
  user,
  onEngage 
}: FeedCardComponentProps) => {
  const { track } = useAnalytics();

  const handleAction = (action: "save_item"|"dismiss_item"|"like_item"|"dislike_item"|"open_item"|"video_play") => {
    track(action, { itemId: id, type, source: source.name });
    const engageAction = action.replace('_item', '') as "save"|"dismiss"|"like"|"dislike"|"open"|"video_play";
    onEngage?.({ itemId: id, action: engageAction });
  };

  const handleOpen = () => {
    handleAction("open_item");
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleVideoPlay = () => {
    handleAction("video_play");
    if (user?.isPremium && youtubeId) {
      // Premium users see inline video
      return;
    }
    window.open(`https://www.youtube.com/watch?v=${youtubeId}`, "_blank");
  };

  const showInlineVideo = user?.isPremium && type === "video" && youtubeId;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Image/Video Section */}
          <div className="relative sm:w-48 h-48 sm:h-32 flex-shrink-0">
            {showInlineVideo ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className="w-full h-full rounded-lg"
                allowFullScreen
                title={title}
              />
            ) : (
              <div 
                className="w-full h-full bg-cover bg-center rounded-lg cursor-pointer relative"
                style={{ 
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted-foreground)/0.1))' 
                }}
                onClick={type === "video" ? handleVideoPlay : handleOpen}
              >
                {type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/70 rounded-full p-3">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                )}
                {!user?.isPremium && youtubeId && (
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      Watch on YouTube
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 sm:py-4 sm:pr-4 sm:pl-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 
                  className="font-semibold text-foreground line-clamp-2 cursor-pointer hover:text-primary"
                  onClick={handleOpen}
                >
                  {title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{source.name}</span>
                  <span>•</span>
                  <time dateTime={publishedAt}>
                    {new Date(publishedAt).toLocaleDateString()}
                  </time>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleOpen}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {summary}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleAction("like_item")}
                >
                  <Heart className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleAction("save_item")}
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleAction("dismiss_item")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};