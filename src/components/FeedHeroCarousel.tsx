import { useState } from "react";
import { Heart, Bookmark, Share2, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipLink } from "@/components/ChipLink";
import { format } from "date-fns";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { FeedItem } from "@/hooks/useInfiniteFeed";
import YouTubePlayer from "@/components/YouTubePlayer";
import { track } from "@/lib/analytics";
import { getYouTubeVideoId, getYouTubeThumbnailFromUrl } from "@/lib/youtube";

interface FeedHeroCarouselProps {
  items: FeedItem[];
  onLike: (id: string) => Promise<boolean>;
  onSave: (id: string) => Promise<boolean>;
  onDismiss: (id: string) => Promise<boolean>;
  onShare: (id: string) => void;
  getState: (id: string) => any;
  isLoading: (id: string) => boolean;
  topicsMap: {
    l1: Map<number, { label: string; slug: string }>;
    l2: Map<number, { label: string; slug: string }>;
    l3: Map<string, string>;
  };
}

export const FeedHeroCarousel = ({
  items,
  onLike,
  onSave,
  onDismiss,
  onShare,
  getState,
  isLoading,
  topicsMap,
}: FeedHeroCarouselProps) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => new Set(prev).add(itemId));
  };

  const handleAction = async (item: FeedItem, action: 'like' | 'save' | 'dismiss') => {
    const actionMap = {
      like: onLike,
      save: onSave,
      dismiss: onDismiss
    };
    await actionMap[action](item.id.toString());
    track(`${action}_item`, {
      drop_id: item.id,
      content_id: item.id,
      source: item.source_name,
    });
  };

  // Take top 5 items for carousel
  const heroItems = items.slice(0, 5);

  if (heroItems.length === 0) return null;

  return (
    <div className="mb-8">
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {heroItems.map((item) => {
            const state = getState(item.id.toString());
            const loading = isLoading(item.id.toString());
            
            // Extract video ID from URL if not in database
            const videoId = item.youtube_video_id || (item.type === 'video' ? getYouTubeVideoId(item.url) : null);
            
            // Generate thumbnail from URL if not in database
            const imageUrl = item.image_url || 
                             item.youtube_thumbnail_url || 
                             (item.type === 'video' ? getYouTubeThumbnailFromUrl(item.url) : null);
            
            const showBadges = item.reason_for_ranking && item.reason_for_ranking !== 'Relevant content';
            const hasImageError = imageErrors.has(item.id.toString());

            return (
              <CarouselItem key={item.id}>
                <Card className="overflow-hidden border-2 shadow-lg">
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-2 gap-0">
                      {/* Image/Video Section */}
                      <div className="relative aspect-video md:aspect-square bg-muted">
                        {item.type === 'video' && videoId ? (
                          <div className="w-full h-full relative">
                            {imageUrl && !hasImageError && (
                              <img
                                src={imageUrl}
                                alt={item.title}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={() => handleImageError(item.id.toString())}
                              />
                            )}
                            <YouTubePlayer
                              videoId={videoId}
                              contentId={item.id.toString()}
                              className="relative w-full h-full z-10"
                              isPremium={true}
                              lazy={false}
                            />
                          </div>
                        ) : imageUrl && !hasImageError ? (
                          <img
                            src={imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(item.id.toString())}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                            <span className="text-4xl">
                              {item.type === 'video' ? '🎥' : '📰'}
                            </span>
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
                          onClick={() => {
                            track("content_click", {
                              drop_id: item.id,
                              content_id: item.id,
                              source: item.source_name,
                            });
                          }}
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

                        {/* Tags: L1, L2, L3 */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {/* L1 Topic */}
                          {item.l1_topic_id && topicsMap.l1.get(item.l1_topic_id) && (
                            <ChipLink
                              to={`/topics/${topicsMap.l1.get(item.l1_topic_id)!.slug}`}
                              position={0}
                              className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {topicsMap.l1.get(item.l1_topic_id)!.label}
                            </ChipLink>
                          )}
                          
                          {/* L2 Topic */}
                          {item.l2_topic_id && topicsMap.l2.get(item.l2_topic_id) && (
                            <ChipLink
                              to={`/topics/${topicsMap.l2.get(item.l2_topic_id)!.slug}`}
                              position={1}
                              className="bg-green-500 text-white hover:bg-green-600"
                            >
                              {topicsMap.l2.get(item.l2_topic_id)!.label}
                            </ChipLink>
                          )}
                          
                          {/* L3 Tags */}
                          {item.tags && item.tags.map((tag, index) => {
                            const slug = topicsMap.l3.get(tag);
                            return slug ? (
                              <ChipLink
                                key={tag}
                                to={`/topics/${slug}`}
                                position={2 + index}
                                className="bg-orange-400 text-white hover:bg-orange-500"
                              >
                                {tag}
                              </ChipLink>
                            ) : null;
                          })}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-auto pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(item, 'like')}
                            disabled={loading}
                            className={state?.isLiked ? "text-red-500" : ""}
                          >
                            <Heart className={`h-4 w-4 ${state?.isLiked ? "fill-current" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(item, 'save')}
                            disabled={loading}
                            className={state?.isSaved ? "text-blue-500" : ""}
                          >
                            <Bookmark className={`h-4 w-4 ${state?.isSaved ? "fill-current" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onShare(item.id.toString())}
                            disabled={loading}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction(item, 'dismiss')}
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
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    </div>
  );
};
