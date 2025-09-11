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
    <Card className="overflow-hidden hover:shadow-md transition-shadow bg-background border">
      <CardContent className="p-0">
        <div className="flex flex-col h-full">
          {/* Image/Video Section */}
          <div className="relative w-full aspect-video overflow-hidden">
            {showInlineVideo ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className="w-full h-full"
                allowFullScreen
                title={title}
              />
            ) : (
              <div 
                className="w-full h-full bg-cover bg-center cursor-pointer relative group"
                style={{ 
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted-foreground)/0.1))' 
                }}
                onClick={type === "video" ? handleVideoPlay : handleOpen}
              >
                {type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <div className="bg-black/70 rounded-full p-3 group-hover:scale-110 transition-transform">
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
                {!imageUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-muted-foreground text-sm">No image available</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h3 
                  className="font-semibold text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors text-sm leading-tight"
                  onClick={handleOpen}
                >
                  {title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="truncate">{source.name}</span>
                  <span>•</span>
                  <time dateTime={publishedAt} className="whitespace-nowrap">
                    {new Date(publishedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </time>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleOpen} className="flex-shrink-0">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
              {summary}
            </p>

            <div className="flex items-center justify-between gap-2 mt-auto">
              <div className="flex gap-1 flex-wrap min-w-0 flex-1">
                {tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs py-0 px-2 truncate">
                    {tag}
                  </Badge>
                ))}
                {tags.length > 2 && (
                  <Badge variant="outline" className="text-xs py-0 px-2">
                    +{tags.length - 2}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("like_item")}
                  className="h-7 w-7 p-0"
                >
                  <Heart className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("save_item")}
                  className="h-7 w-7 p-0"
                >
                  <Bookmark className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleAction("dismiss_item")}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};