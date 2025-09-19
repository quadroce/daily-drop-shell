import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Star,
  ThumbsDown,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";
import {
  getYouTubeFallbackThumbnail,
  getYouTubeThumbnailFromUrl,
} from "@/lib/youtube";
import { requireSession } from "@/lib/auth";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { useUserProfile } from "@/hooks/useUserProfile";
import { FullWidthVideoCard } from "@/components/FullWidthVideoCard";
import { track } from "@/lib/analytics";
import { trackDropViewed } from "@/lib/trackers/content";
import { Seo } from "@/components/Seo";
import { useEngagementState } from "../hooks/useEngagementState";

// Helper function for getting image URLs
const getImageUrl = (drop: any) => {
  if (drop.type === "video" && drop.url) {
    const thumbnailUrl = getYouTubeThumbnailFromUrl(drop.url);
    if (thumbnailUrl) return thumbnailUrl;
  }
  return drop.image_url;
};

// DropCard component extracted outside Feed to fix React hooks error #310
const DropCard = (
  { drop, isSponsored = false, updateEngagement, track, getTopicSlug, topicsLoading, getState, isLoading }: { 
    drop: any; 
    isSponsored?: boolean;
    updateEngagement: (dropId: string, action: string) => Promise<boolean>;
    track: (event: string, params: any) => void;
    getTopicSlug: (label: string) => string;
    topicsLoading: boolean;
    getState: (dropId: string) => any;
    isLoading: (dropId: string) => boolean;
  },
) => {
  const imageUrl = getImageUrl(drop);
  const dropId = drop.id.toString();
  const engagementState = getState(dropId);
  const loadingState = isLoading(dropId);

  return (
    <TooltipProvider>
      <Card
        className={`group hover:bg-card-hover transition-all duration-200 ${
          isSponsored ? "border-warning/40 bg-warning/5" : ""
        }`}
      >
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
                  <span className="text-sm">{drop.favicon}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {drop.source || drop.source_name || "Unknown Source"}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {drop.published_at
                      ? new Date(drop.published_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )
                      : new Date().toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                  </time>
                  {isSponsored && (
                    <Badge
                      variant="outline"
                      className="bg-warning/10 text-warning border-warning/30 text-xs"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      Sponsored
                    </Badge>
                  )}
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
                        source: drop.source || drop.source_name,
                        topic: drop.l1_topic || drop.tags?.[0],
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
                {/* L1 Topic (Blue) */}
                {drop.l1_topic && (
                  topicsLoading || !getTopicSlug(drop.l1_topic)
                    ? (
                      <Badge variant="tag-l1" className="text-xs py-0 px-1">
                        {drop.l1_topic}
                      </Badge>
                    )
                    : (
                      <ChipLink
                        to={`/topics/${getTopicSlug(drop.l1_topic)}`}
                        variant="tag-l1"
                        className="text-xs py-0 px-1"
                      >
                        {drop.l1_topic}
                      </ChipLink>
                    )
                )}

                {/* L2 Topic (Green) */}
                {drop.l2_topic && (
                  topicsLoading || !getTopicSlug(drop.l2_topic)
                    ? (
                      <Badge variant="tag-l2" className="text-xs py-0 px-1">
                        {drop.l2_topic}
                      </Badge>
                    )
                    : (
                      <ChipLink
                        to={`/topics/${getTopicSlug(drop.l2_topic)}`}
                        variant="tag-l2"
                        className="text-xs py-0 px-1"
                      >
                        {drop.l2_topic}
                      </ChipLink>
                    )
                )}

                {/* L3 Tags (Purple) - Show all available tags */}
                {drop.tags?.filter((tag) => tag && tag.trim()).map((
                  tag: string,
                ) => (
                  topicsLoading || !getTopicSlug(tag)
                    ? (
                      <Badge
                        key={`l3-${tag}`}
                        variant="tag-l3"
                        className="text-xs py-0 px-1"
                      >
                        {tag}
                      </Badge>
                    )
                    : (
                      <ChipLink
                        key={`l3-${tag}`}
                        to={`/topics/${getTopicSlug(tag)}`}
                        variant="tag-l3"
                        className="text-xs py-0 px-1"
                      >
                        {tag}
                      </ChipLink>
                    )
                ))}
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
                            source: drop.source || drop.source_name,
                            topic: drop.l1_topic || drop.tags?.[0],
                          });
                        }
                      }}
                    >
                      <Heart className={`h-3 w-3 ${engagementState.isLiked ? "fill-current" : ""}`} />
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
                              source: drop.source || drop.source_name,
                              topic: drop.l1_topic || drop.tags?.[0],
                            });
                          }
                        }}
                      >
                        <Bookmark className={`h-3 w-3 ${engagementState.isSaved ? "fill-current" : ""}`} />
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
                            source: drop.source || drop.source_name,
                            topic: drop.l1_topic || drop.tags?.[0],
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
                      <ThumbsDown className={`h-3 w-3 ${engagementState.isDisliked ? "fill-current" : ""}`} />
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
            {imageUrl
              ? (
                <div className="relative w-full h-full">
                  <img
                    src={imageUrl}
                    alt={drop.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Try fallback for YouTube videos
                      if (drop.type === "video" && drop.url) {
                        const fallbackUrl = getYouTubeFallbackThumbnail(
                          drop.url,
                        );
                        if (
                          fallbackUrl && e.currentTarget.src !== fallbackUrl
                        ) {
                          e.currentTarget.src = fallbackUrl;
                          return;
                        }
                      }

                      // Hide image and show placeholder
                      e.currentTarget.style.display = "none";
                      const placeholder = e.currentTarget.closest(".relative")
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
              )
              : (
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

// Add YouTube preconnect for performance
if (typeof document !== "undefined") {
  const preconnectYT = document.createElement("link");
  preconnectYT.rel = "preconnect";
  preconnectYT.href = "https://www.youtube-nocookie.com";
  document.head.appendChild(preconnectYT);

  const preconnectYTImg = document.createElement("link");
  preconnectYTImg.rel = "preconnect";
  preconnectYTImg.href = "https://i.ytimg.com";
  document.head.appendChild(preconnectYTImg);
}

const Feed = () => {
  const navigate = useNavigate();
  const { fallbackPrefs, isFallbackActive } = usePreferences();
  const { getTopicSlug, isLoading: topicsLoading } = useTopicsMap();
  const { isPremium } = useUserProfile();
  const { updateEngagement, initializeStates, getState, isLoading: isEngagementLoading } = useEngagementState();
  const [drops, setDrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState<boolean | null>(null);

  const mockDrops = [
    {
      id: 1,
      title: "The Future of AI in Content Discovery",
      source: "TechCrunch",
      favicon: "🔥",
      tags: ["AI", "Technology", "Content"],
      type: "article",
      url: "https://techcrunch.com/ai-content-discovery",
      image_url: null,
      summary:
        "Exploring how artificial intelligence is revolutionizing the way we discover and consume digital content across platforms.",
    },
    {
      id: 2,
      title: "Building Scalable React Applications",
      source: "YouTube - Vercel",
      favicon: "📺",
      tags: ["React", "JavaScript", "Development"],
      type: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      image_url: null,
      summary:
        "Learn best practices for building React applications that can scale to millions of users with modern techniques.",
    },
    {
      id: 3,
      title: "The Psychology of Daily Habits",
      source: "Medium",
      favicon: "📖",
      tags: ["Psychology", "Productivity", "Habits"],
      type: "article",
      url: "https://medium.com/psychology-habits",
      image_url:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=200&fit=crop",
      summary:
        "Understanding the science behind habit formation and how small changes can lead to significant improvements in daily life.",
    },
    {
      id: 4,
      title: "Climate Tech Innovations in 2024",
      source: "Nature",
      favicon: "🌱",
      tags: ["Climate", "Technology", "Innovation"],
      type: "research",
      url: "https://nature.com/climate-tech-2024",
      image_url:
        "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400&h=200&fit=crop",
      summary:
        "A comprehensive review of breakthrough technologies addressing climate change challenges in 2024.",
    },
    {
      id: 5,
      title: "Advanced TypeScript Patterns",
      source: "YouTube - Matt Pocock",
      favicon: "📺",
      tags: ["TypeScript", "Programming", "Tutorial"],
      type: "video",
      url: "https://www.youtube.com/watch?v=VE6CT8yHJIE",
      image_url: null,
      summary:
        "Master advanced TypeScript patterns and techniques to write more robust and maintainable code.",
    },
  ];

  useEffect(() => {
    const fetchCandidateDrops = async () => {
      try {
        console.log("[Feed] Starting fetch candidate drops...");

        // Check authentication status
        const { data: { user }, error: authError } = await supabase.auth
          .getUser();
        console.log("[Feed] User authentication:", {
          userId: user?.id,
          email: user?.email,
          authError,
          userIdLength: user?.id?.length,
        });

        // Check user preferences
        if (user?.id) {
          const { data: prefs, error: prefsError } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(); // Use maybeSingle instead of single to handle no results

          console.log("[Feed] User preferences:", prefs, "error:", prefsError);

          // Check if user has meaningful preferences set
          const hasValidPrefs = prefs &&
            prefs.selected_topic_ids &&
            prefs.selected_topic_ids.length > 0;

          if (!hasValidPrefs) {
            console.log(
              "[Feed] No valid preferences found - showing setup message",
            );
            setHasPreferences(false);
            setLoading(false);
            return;
          }

          setHasPreferences(true);
        } else {
          setHasPreferences(false);
          setLoading(false);
          return;
        }

        // Use content ranking edge function with source diversity
        console.log("[Feed] Calling content-ranking edge function...");
        const { data: rankingResponse, error } = await supabase.functions
          .invoke("content-ranking", {
            body: {
              limit: 5,
              refresh_cache: true, // Force cache refresh to apply new YouTube limit constraint
            },
          });

        console.log("[Feed] Raw response from edge function:", {
          rankingResponse,
          error,
        });

        const data = rankingResponse?.ranked_drops;
        console.log("[Feed] Parsed data:", {
          data,
          dataType: typeof data,
          isArray: Array.isArray(data),
          length: data?.length,
          constraints: rankingResponse?.constraints_applied,
          hasRankedDrops: !!rankingResponse?.ranked_drops,
          responseKeys: rankingResponse ? Object.keys(rankingResponse) : null,
        });

        if (error) {
          console.error("[Feed] Edge function error:", error);
        }

        if (!data || data.length === 0) {
          console.warn("[Feed] No data from edge function, falling back...");
        }

        if (error || !data || data.length === 0) {
          console.error("Error fetching ranked drops:", error);

          // Fallback to old method if new ranking fails
          console.log("[Feed] Falling back to basic candidate drops...");
          const { data: fallbackData, error: fallbackError } = await supabase
            .rpc("get_candidate_drops", { limit_n: 10 });

          if (fallbackError || !fallbackData || fallbackData.length === 0) {
            // Check if fallback is active and use mock data
            if (isFallbackActive && fallbackPrefs) {
              console.debug("[Feed] Using fallback mode with mock data");
              setDrops(mockDrops.slice(0, 5)); // Use first 5 mock drops
              setLoading(false);
              return;
            }

            console.log(
              "[Feed] No data found but user has preferences - showing empty state",
            );
            setDrops([]);
            setLoading(false);
            return;
          }

          // Use fallback data
          const dropsWithSources = await Promise.all(
            fallbackData.map(async (drop) => {
              if (drop.source_id) {
                const { data: source } = await supabase
                  .from("sources")
                  .select("name")
                  .eq("id", drop.source_id)
                  .single();

                return {
                  ...drop,
                  source: source?.name || "Unknown Source",
                  favicon: drop.type === "video" ? "📺" : "📄",
                  final_score: null,
                  reason_for_ranking: "Standard recommendation",
                };
              }
              return {
                ...drop,
                source: "Unknown Source",
                favicon: drop.type === "video" ? "📺" : "📄",
                final_score: null,
                reason_for_ranking: "Standard recommendation",
              };
            }),
          );

          console.log(
            "[Feed] Using fallback drops with sources:",
            dropsWithSources,
          );
          setDrops(dropsWithSources);
          setLoading(false);
          return;
        }

        console.log("[Feed] Found ranked drops:", data.length);

        if (data) {
          // Add favicon and preserve existing source names
          const dropsWithSources = await Promise.all(
            data.map(async (drop) => {
              let sourceName = drop.source; // Use existing source name from backend

              // Only fetch from database if no source name exists
              if (!sourceName && drop.source_id) {
                const { data: source } = await supabase
                  .from("sources")
                  .select("name")
                  .eq("id", drop.source_id)
                  .single();
                sourceName = source?.name;
              }

              return {
                ...drop,
                source: sourceName || "Unknown Source",
                favicon: drop.type === "video" ? "📺" : "📄",
              };
            }),
          );

          console.log(
            "[Feed] Ranked drops with sources:",
            dropsWithSources.map((d) => ({
              id: d.id,
              title: d.title,
              l1_topic: d.l1_topic,
              l2_topic: d.l2_topic,
              tags: d.tags,
            })),
          );
          setDrops(dropsWithSources);

          // Track that drops were viewed in the feed
          if (dropsWithSources.length > 0) {
            trackDropViewed({
              drop_id: dropsWithSources[0]?.id,
              topic: dropsWithSources[0]?.l1_topic ||
                dropsWithSources[0]?.tags?.[0],
            });
          }
        }
      } catch (error) {
        console.error("Error fetching drops:", error);

        // Fallback to mock data if there's an error and fallback is active
        if (isFallbackActive && fallbackPrefs) {
          console.debug("[Feed] Exception caught, using fallback mode");
          setDrops(mockDrops.slice(0, 5));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateDrops();
  }, [isFallbackActive, fallbackPrefs]);

  // Initialize engagement states when drops are loaded
  useEffect(() => {
    if (drops.length > 0) {
      const dropIds = drops.map(drop => drop.id.toString());
      initializeStates(dropIds);
    }
  }, [drops, initializeStates]);


  /* const sponsoredContent = {
    id: "sponsored-1",
    title: "Unlock Premium Development Tools",
    source: "DevTools Pro",
    favicon: "⚡",
    tags: ["Sponsored", "Tools", "Development"],
    type: "sponsored",
    url: "#",
    image_url:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=200&fit=crop",
    summary:
      "Boost your development workflow with premium tools designed for modern developers.",
  };*/

  if (loading) {
    console.log("[Feed] Rendering loading state");
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            Your Daily Drop is being prepared.
          </div>
        </div>
      </div>
    );
  }

  // Show preferences setup if user has no preferences
  if (hasPreferences === false) {
    console.log("[Feed] Rendering preferences setup message");
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-16">
          <div className="space-y-6">
            <div className="space-y-2">
              <Settings className="h-16 w-16 text-muted-foreground mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">
                Setup Your Preferences
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                To get personalized daily drops, please set up your topic and
                language preferences first.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                onClick={() => navigate("/preferences")}
                className="px-8"
              >
                <Settings className="h-4 w-4 mr-2" />
                Set Up Preferences
              </Button>
              <p className="text-xs text-muted-foreground">
                Choose your interests and languages to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log(
    "[Feed] Rendering main feed, hasPreferences:",
    hasPreferences,
    "drops.length:",
    drops.length,
  );

  return (
    <>
      <Seo
        title="Your Daily Content Feed - DailyDrops"
        description="Discover personalized content curated by AI based on your interests. Get daily tech updates, insights, and trending topics delivered to your feed."
        canonical="https://dailydrops.cloud/feed"
        noindex={!hasPreferences}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "DailyDrops Personal Feed",
          "description":
            "Personalized content discovery feed with AI-curated articles, videos, and insights",
          "isPartOf": {
            "@type": "WebSite",
            "name": "DailyDrops",
            "url": "https://dailydrops.cloud",
          },
        }}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Today's Drops
          </h1>
          <p className="text-muted-foreground">
            Curated content based on your interests
          </p>

          {/* Constraint helper */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              ≥1 YouTube per Drop • ≤2 per source • ≤1 sponsored
              {isFallbackActive && (
                <span className="ml-2 px-2 py-1 bg-warning/20 text-warning text-xs rounded">
                  Using temporary preferences
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {drops.length > 0
            ? (
              <>
                {drops.map((drop, index) => {
                  // Check if this is a YouTube video
                  const isYouTube = !!drop.youtube_video_id ||
                    /youtu(\.be|be\.com)/.test(drop.url);

                  // Check if this is the first YouTube video in the list
                  const isFirstYouTubeVideo = isYouTube &&
                    drops.findIndex((d) =>
                        !!d.youtube_video_id ||
                        /youtu(\.be|be\.com)/.test(d.url)
                      ) === index;

                  console.log(
                    `[Feed] Drop ${index}: ${
                      drop.title.substring(0, 30)
                    }... - isYouTube: ${isYouTube}, isFirstYT: ${isFirstYouTubeVideo}, isPremium: ${isPremium}`,
                  );

                  // If premium user and first YouTube video, render full-width video card
                  if (isPremium && isYouTube && isFirstYouTubeVideo) {
                    console.log(
                      `[Feed] Rendering FullWidthVideoCard for drop ${index}`,
                    );
                    return (
                      <FullWidthVideoCard
                        key={drop.id}
                        item={drop}
                         onSave={(id) => updateEngagement(id.toString(), "save")}
                         onLike={(id) => updateEngagement(id.toString(), "like")}
                         onDismiss={(id) => updateEngagement(id.toString(), "dismiss")}
                       />
                     );
                   }

                   // Otherwise render regular card (including subsequent YouTube videos for premium users)
                   console.log(`[Feed] Rendering DropCard for drop ${index}`);
                   return <DropCard 
                     key={drop.id} 
                     drop={drop} 
                     updateEngagement={updateEngagement}
                     track={track}
                     getTopicSlug={getTopicSlug}
                     topicsLoading={topicsLoading}
                     getState={getState}
                     isLoading={isEngagementLoading}
                   />;
                })}

                {/* End of feed message */}
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
                    <span className="text-sm text-muted-foreground">
                      That's it for today.
                    </span>
                    <span className="text-lg">✨</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Check back tomorrow for fresh content
                  </p>
                </div>
              </>
            )
            : (
              // Show different messages based on preferences state
              hasPreferences === true
                ? (
                  // User has preferences but no content found
                  <div className="text-center py-16">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="text-6xl mb-4">📭</div>
                        <h2 className="text-2xl font-bold text-foreground">
                          No Drops Found
                        </h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          We couldn't find any content matching your current
                          preferences. Try adjusting your topic or language
                          settings.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => navigate("/preferences")}
                          className="px-8"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Adjust Preferences
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Modify your interests to discover more content
                        </p>
                      </div>
                    </div>
                  </div>
                )
                : (
                  // Fallback message
                  <div className="text-center py-12">
                    <div className="text-muted-foreground">
                      Loading your personalized content...
                    </div>
                  </div>
                )
            )}
        </div>
      </div>
    </>
  );
};

export default Feed;
