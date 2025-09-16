import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { DailyDrop } from "@/components/DailyDrop";
import { ArchiveNav } from "@/components/ArchiveNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTopicDaily, getTopicArchive, getTopicData } from "@/lib/api/topics";
import { useAnalytics } from "@/lib/analytics";
import { useEffect } from "react";
import { format, parseISO } from "date-fns";

export const TopicDailyArchivePage = () => {
  const { slug, date } = useParams<{ slug: string; date: string }>();
  const { track } = useAnalytics();

  // Mock user data - replace with real auth
  const user = { 
    isPremium: new URLSearchParams(window.location.search).has('premium'),
    isLoggedIn: true 
  };

  useEffect(() => {
    track('page_view', { page: 'topic_daily', slug, date });
  }, [slug, date, track]);

  const { data: topic } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => getTopicData(slug!),
    enabled: !!slug,
  });

  const { data: archive } = useQuery({
    queryKey: ['topic-archive', slug],
    queryFn: () => getTopicArchive(slug!, user.isPremium),
    enabled: !!slug,
  });

  const { data: dailyItems, isLoading, error } = useQuery({
    queryKey: ['topic-daily', slug, date],
    queryFn: () => getTopicDaily(slug!, date!),
    enabled: !!slug && !!date,
  });

  if (!slug || !date) {
    return <Navigate to="/404" replace />;
  }

  if (error) {
    return <Navigate to="/404" replace />;
  }

  const articleCount = dailyItems?.length || 0;
  const videoCount = dailyItems?.filter(item => item.type === 'video').length || 0;
  const canonical = `${window.location.origin}/topics/${slug}/${date}`;
  const formattedDate = format(parseISO(date), 'MMMM d, yyyy');
  const title = `${topic?.title} - ${formattedDate} (${articleCount} articles)`;
  const description = `Explore ${articleCount} curated articles ${videoCount > 0 ? `and ${videoCount} videos ` : ''}from ${topic?.title} on ${formattedDate}. Stay updated with the latest insights, research, and trends in ${topic?.title?.toLowerCase()}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${topic?.title} - ${formattedDate}`,
    "description": `Daily content drop for ${topic?.title} on ${formattedDate}`,
    "url": canonical,
    "datePublished": date,
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Topics",
          "item": `${window.location.origin}/topics`
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": topic?.title,
          "item": `${window.location.origin}/topics/${slug}`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Archive",
          "item": `${window.location.origin}/topics/${slug}/archive`
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": formattedDate,
          "item": canonical
        }
      ]
    }
  };

  const handleEngage = (engagement: { itemId: string; action: "save"|"dismiss"|"like"|"dislike"|"open"|"video_play" }) => {
    track(engagement.action === 'save' ? 'save_item' : 
          engagement.action === 'dismiss' ? 'dismiss_item' :
          engagement.action === 'like' ? 'like_item' :
          engagement.action === 'dislike' ? 'dislike_item' :
          engagement.action === 'open' ? 'open_item' : 'video_play', { 
      itemId: engagement.itemId, 
      slug, 
      date,
      context: 'daily_archive' 
    });
  };

  return (
    <>
      <Seo
        title={title}
        description={description}
        canonical={canonical}
        jsonLd={jsonLd}
      />

      {archive && (
        <ArchiveNav
          slug={slug}
          selectedDate={date}
          availableDates={archive.availableDates}
        />
      )}

      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
              <li>
                <Link to="/topics" className="hover:text-foreground transition-colors">Topics</Link>
              </li>
              <li>/</li>
              <li>
                <Link to={`/topics/${slug}`} className="hover:text-foreground transition-colors">{topic?.title}</Link>
              </li>
              <li>/</li>
              <li>
                <Link to={`/topics/${slug}/archive`} className="hover:text-foreground transition-colors">Archive</Link>
              </li>
              <li>/</li>
              <li className="text-foreground font-medium">{formattedDate}</li>
            </ol>
          </nav>
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {topic?.title}
              </h1>
              <div className="flex items-center gap-4">
                <p className="text-lg text-muted-foreground">
                  {formattedDate}
                </p>
                {articleCount > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {articleCount} article{articleCount !== 1 ? 's' : ''}
                    {videoCount > 0 && ` • ${videoCount} video${videoCount !== 1 ? 's' : ''}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4 border rounded-lg p-4">
              <Skeleton className="h-32 w-48 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : dailyItems && (
        <DailyDrop
          items={dailyItems}
          constraints={{
            minYoutube: 1,
            maxPerSource: 2,
            maxSponsored: 1
          }}
          user={user}
          onEngage={handleEngage}
          hideConstraintAlert={true}
        />
      )}
    </>
  );
};