import { ExternalLink, Heart, Bookmark, Share2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipLink } from "@/components/ChipLink";
import { format } from "date-fns";
import { useState } from "react";

interface FeedItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  youtube_thumbnail_url?: string | null;
  youtube_video_id?: string | null;
  source_name?: string;
  published_at: string | null;
  type: string;
  tags: string[];
  l1_topic_id?: number | null;
  l2_topic_id?: number | null;
  final_score?: number;
  reason_for_ranking?: string;
}

interface FeedHeroProps {
  item: FeedItem;
  onLike: (id: string) => Promise<boolean>;
  onSave: (id: string) => Promise<boolean>;
  onDismiss: (id: string) => Promise<boolean>;
  onShare: (id: string) => void;
  getTopicSlug: (label: string) => string;
  getState: (id: string) => any;
  isLoading: (id: string) => boolean;
}

export const FeedHero = ({
  item,
  onLike,
  onSave,
  onDismiss,
  onShare,
  getTopicSlug,
  getState,
  isLoading
}: FeedHeroProps) => {
  const [imageError, setImageError] = useState(false);
  const state = getState(item.id);
  const loading = isLoading(item.id);

  const imageUrl = item.image_url || item.youtube_thumbnail_url;
  const showBadges = item.reason_for_ranking && item.reason_for_ranking !== 'Relevant content';

  const handleAction = async (action: 'like' | 'save' | 'dismiss') => {
    const actionMap = {
      like: onLike,
      save: onSave,
      dismiss: onDismiss
    };
    await actionMap[action](item.id);
  };

  return (
    <Card className="mb-8 overflow-hidden border-2 shadow-lg">
      <CardContent className="p-0">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image Section */}
          <div className="relative aspect-video md:aspect-square bg-muted">
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <span className="text-4xl">📰</span>
              </div>
            )}
            {item.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[16px] border-l-primary border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
                </div>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-6 flex flex-col">
            {/* Badges */}
            {showBadges && (
              <div className="flex flex-wrap gap-2 mb-4">
                {item.reason_for_ranking?.includes('Fresh') && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                    ✨ Fresh content
                  </Badge>
                )}
                {item.reason_for_ranking?.includes('interest') && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    🎯 Matches interests
                  </Badge>
                )}
              </div>
            )}

            {/* Source & Date */}
            {(item.source_name || item.published_at) && (
              <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                {item.source_name && <span className="font-medium">{item.source_name}</span>}
                {item.published_at && (
                  <>
                    <span>•</span>
                    <time dateTime={item.published_at}>
                      {format(new Date(item.published_at), "MMM d, yyyy")}
                    </time>
                  </>
                )}
              </div>
            )}

            {/* Title */}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mb-3"
            >
              <h2 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors flex items-start gap-2">
                {item.title}
                <ExternalLink className="h-5 w-5 opacity-50 group-hover:opacity-100 flex-shrink-0 mt-1" />
              </h2>
            </a>

            {/* Summary */}
            {item.summary && (
              <p className="text-muted-foreground mb-4 line-clamp-3">{item.summary}</p>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {item.tags.map((tag, index) => (
                  <ChipLink key={tag} to={`/topics/${getTopicSlug(tag)}`} position={index}>
                    {tag}
                  </ChipLink>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-auto pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction('like')}
                disabled={loading}
                className={state?.liked ? "text-red-500" : ""}
              >
                <Heart className={`h-4 w-4 ${state?.liked ? "fill-current" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction('save')}
                disabled={loading}
                className={state?.saved ? "text-blue-500" : ""}
              >
                <Bookmark className={`h-4 w-4 ${state?.saved ? "fill-current" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShare(item.id)}
                disabled={loading}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction('dismiss')}
                disabled={loading}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
