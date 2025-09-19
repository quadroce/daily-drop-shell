import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChipLink } from "@/components/ChipLink";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bookmark,
  ExternalLink,
  Heart,
  Image,
  Play,
  Settings,
  ThumbsDown,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";
import {
  getYouTubeFallbackThumbnail,
  getYouTubeThumbnailFromUrl,
} from "@/lib/youtube";
import { requireSession } from "@/lib/auth";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { track } from "@/lib/analytics";
import { Seo } from "@/components/Seo";
import { useEngagementState } from "../hooks/useEngagementState";
import { useInfiniteFeed, FeedItem } from "@/hooks/useInfiniteFeed";
import { InfiniteFeedList } from "@/components/InfiniteFeedList";

// Helper function for getting image URLs
const getImageUrl = (drop: FeedItem) => {
  if (drop.type === "video" && drop.url) {
    const thumbnailUrl = getYouTubeThumbnailFromUrl(drop.url);
    if (thumbnailUrl) return thumbnailUrl;
  }
  if (drop.youtube_thumbnail_url) return drop.youtube_thumbnail_url;
  return drop.image_url;
};

// DropCard component for rendering individual feed items
const DropCard = ({
  drop,
  updateEngagement,
  track,
  getTopicSlug,
  topicsLoading,
  getState,
  isLoading,
}: {
  drop: FeedItem;
  updateEngagement: (dropId: string, action: string) => Promise<boolean>;
  track: (event: string, params: any) => void;
  getTopicSlug: (label: string) => string | null;
  topicsLoading: boolean;
  getState: (dropId: string) => any;
  isLoading: (dropId: string) => boolean;
}) => {
  const imageUrl = getImageUrl(drop);
  const dropId = drop.id.toString();
  const engagementState = getState(dropId);
  const loadingState = isLoading(dropId);

  return (
    <TooltipProvider>
      <Card className="group hover:bg-card-hover transition-all duration-200">
        <div className="flex">
          {/* Content Section - Left */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                  <a
                    href={drop.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {drop.title}
                  </a>
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground truncate">
                    Source ID: {drop.source_id || "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {drop.published_at
                      ? new Date(drop.published_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : new Date().toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                  </time>
                </div>

                {/* Ranking reason */}
                {drop.reason_for_ranking && (
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs bg-primary/5 text-primary/80 border-primary/20"
                    >
                      {drop.reason_for_ranking}
                    </Badge>
                  </div>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-6 w-6"
                    onClick={() => {
                      // Track content click
                      track("content_click", {
                        drop_id: drop.id,
                        content_id: drop.id,
                        source: drop.source_id,
                        topic: drop.tags?.[0],
                      });
                      window.open(drop.url, "_blank");
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open link</TooltipContent>
              </Tooltip>
            </div>

            {/* Synopsis */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground line-clamp-2">
                {drop.summary || "No summary available."}
              </p>
            </div>

            {/* Tags and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {/* Tags from the tags array */}
                {drop.tags?.filter((tag) => tag && tag.trim()).map((tag: string) => {
                  const topicSlug = getTopicSlug(tag);
                  return topicsLoading || !topicSlug ? (
                    <Badge
                      key={`tag-${tag}`}
                      variant="tag-l3"
                      className="text-xs py-0 px-1"
                    >
                      {tag}
                    </Badge>
                  ) : (
                    <ChipLink
                      key={`tag-${tag}`}
                      to={`/topics/${topicSlug}`}
                      variant="tag-l3"
                      className="text-xs py-0 px-1"
                    >
                      {tag}
                    </ChipLink>
                  );
                })}
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${
                        engagementState.isLiked
                          ? "bg-success/20 text-success hover:bg-success/30"
                          : "hover:bg-success/10 hover:text-success"
                      }`}
                      disabled={loadingState}
                      aria-pressed={engagementState.isLiked}
                      onClick={async () => {
                        const success = await updateEngagement(dropId, "like");
                        if (success) {
                          track("like_item", {
                            drop_id: drop.id,
                            content_id: drop.id,
                            source: drop.source_id,
                            topic: drop.tags?.[0],
                          });
                        }
                      }}
                    >
                      <Heart
                        className={`h-3 w-3 ${
                          engagementState.isLiked ? "fill-current" : ""
                        }`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {engagementState.isLiked ? "Unlike" : "Like"}
                  </TooltipContent>
                </Tooltip>

                {/* Only show Save button if not liked (since like auto-saves) */}
                {!engagementState.isLiked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${
                          engagementState.isSaved
                            ? "bg-success/20 text-success hover:bg-success/30"
                            : "hover:bg-success/10 hover:text-success"
                        }`}
                        disabled={loadingState}
                        aria-pressed={engagementState.isSaved}
                        onClick={async () => {
                          const success = await updateEngagement(dropId, "save");
                          if (success) {
                            track("save_item", {
                              drop_id: drop.id,
                              content_id: drop.id,
                              source: drop.source_id,
                              topic: drop.tags?.[0],
                            });
                          }
                        }}
                      >
                        <Bookmark
                          className={`h-3 w-3 ${
                            engagementState.isSaved ? "fill-current" : ""
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {engagementState.isSaved ? "Unsave" : "Save"}
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${
                        engagementState.isDismissed
                          ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                          : "hover:bg-destructive/10 hover:text-destructive"
                      }`}
                      disabled={loadingState}
                      aria-pressed={engagementState.isDismissed}
                      onClick={async () => {
                        const success = await updateEngagement(dropId, "dismiss");
                        if (success) {
                          track("dismiss_item", {
                            drop_id: drop.id,
                            content_id: drop.id,
                            source: drop.source_id,
                            topic: drop.tags?.[0],
                          });
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {engagementState.isDismissed ? "Undismiss" : "Dismiss"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${
                        engagementState.isDisliked
                          ? "bg-muted text-muted-foreground"
                          : "hover:bg-muted"
                      }`}
                      disabled={loadingState}
                      aria-pressed={engagementState.isDisliked}
                      onClick={() => updateEngagement(dropId, "dislike")}
                    >
                      <ThumbsDown
                        className={`h-3 w-3 ${
                          engagementState.isDisliked ? "fill-current" : ""
                        }`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {engagementState.isDisliked ? "Remove dislike" : "Dislike"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Image Section - Right */}
          <div className="relative w-28 h-28 m-4 overflow-hidden rounded-lg flex-shrink-0">
            {imageUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={imageUrl}
                  alt={drop.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Try fallback for YouTube videos
                    if (drop.type === "video" && drop.url) {
                      const fallbackUrl = getYouTubeFallbackThumbnail(drop.url);
                      if (fallbackUrl && e.currentTarget.src !== fallbackUrl) {
                        e.currentTarget.src = fallbackUrl;
                        return;
                      }
                    }

                    // Hide image and show placeholder
                    e.currentTarget.style.display = "none";
                    const placeholder = e.currentTarget
                      .closest(".relative")
                      ?.querySelector("[data-placeholder]");
                    placeholder?.classList.remove("hidden");
                  }}
                />
                {drop.type === "video" && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full p-1">
                      <Play className="h-3 w-3 text-white fill-white" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />

                {/* Fallback placeholder (hidden by default) */}
                <div
                  data-placeholder
                  className="hidden absolute inset-0 bg-muted flex items-center justify-center"
                >
                  <div className="text-center text-muted-foreground">
                    <Image className="h-4 w-4 mx-auto mb-1" />
                    <p className="text-xs">No image</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Image className="h-4 w-4 mx-auto mb-1" />
                  <p className="text-xs">No image</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};

const Feed = () => {
  const navigate = useNavigate();
  const { fallbackPrefs, isFallbackActive } = usePreferences();
  const { getTopicSlug, isLoading: topicsLoading } = useTopicsMap();
  const {
    updateEngagement,
    initializeStates,
    getState,
    isLoading: isEngagementLoading,
  } = useEngagementState();

  // Get user session for feed loading
  const [user, setUser] = useState<any>(null);

  // Initialize infinite feed hook
  const {
    items,
    load,
    loading,
    hasMore,
    error,
    retry,
    initialLoading,
  } = useInfiniteFeed({
    user,
    // Add filters here if needed in future
    language: null,
    l1: null,
    l2: null,
  });

  // Load user session
  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = await requireSession();
        if (!session.user) {
          navigate("/auth");
          return;
        }
        setUser(session.user);
      } catch (err) {
        console.error("❌ Error loading user session:", err);
        navigate("/auth");
      }
    };

    loadUser();
  }, [navigate]);

  // Initialize engagement states when items load
  useEffect(() => {
    if (items.length > 0) {
      const dropIds = items.map((item) => item.id.toString());
      initializeStates(dropIds);
    }
  }, [items, initializeStates]);

  // Show no preferences state
  if (
    !isFallbackActive &&
    (!fallbackPrefs || Object.keys(fallbackPrefs).length === 0)
  ) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-warning mb-4">
              <Settings className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Setup Your Preferences</h2>
            </div>
            <p className="mb-4">
              To get personalized content recommendations, please set up your
              topic preferences first.
            </p>
            <Button onClick={() => navigate("/preferences")}>
              Go to Preferences
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderFeedItem = (item: FeedItem, index: number) => (
    <DropCard
      key={item.id}
      drop={item}
      updateEngagement={updateEngagement}
      track={track}
      getTopicSlug={getTopicSlug}
      topicsLoading={topicsLoading}
      getState={getState}
      isLoading={isEngagementLoading}
    />
  );

  return (
    <>
      <Seo
        title="Your Personalized Feed"
        description="Discover the latest AI and ML content curated just for you"
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Your Feed</h1>
            <p className="text-muted-foreground">
              Discover content ranked by relevance, updated in real-time
            </p>
          </div>

          <div className="min-h-screen">
            <InfiniteFeedList
              items={items}
              load={load}
              hasMore={hasMore}
              loading={loading}
              error={error}
              retry={retry}
              initialLoading={initialLoading}
              renderItem={renderFeedItem}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Feed;