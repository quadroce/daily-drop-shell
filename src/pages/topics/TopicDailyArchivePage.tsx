import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { FeedCard } from "@/components/FeedCard";
import { ArchiveNav } from "@/components/ArchiveNav";
import { TopicCtaBar } from "@/components/topics/TopicCtaBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { getTopicDaily, getTopicArchive, getTopicData } from "@/lib/api/topics";
import { useAnalytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffect } from "react";
import { format, parseISO, isAfter, subDays } from "date-fns";
import { isOlderThan90Days, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const TopicDailyArchivePage = () => {
  const { slug, date } = useParams<{ slug: string; date: string }>();
  const { track } = useAnalytics();
  const { session } = useAuth();
  const { isPremium } = useUserProfile();

  const user = { 
    isPremium,
    isLoggedIn: !!session 
  };

  useEffect(() => {
    track('page_view', { 
      page: 'topic_daily', 
      slug, 
      date,
      topic_slug: slug,
      location: 'daily_archive'
    });
  }, [slug, date, track]);

  const { data: topic } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => getTopicData(slug!),
    enabled: !!slug,
  });

  const { data: archive } = useQuery({
    queryKey: ['topic-archive', slug, isPremium],
    queryFn: () => getTopicArchive(slug!, isPremium),
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
  const title = `Daily Drop on ${topic?.title} – ${formattedDate} | DailyDrops`;
  const description = `Curated daily feed on ${topic?.title} for ${formattedDate}: top articles, videos & insights.`;
  
  // Check if this is older than 90 days for noindex using utility
  const isOld = isOlderThan90Days(parseISO(date));

  // Enhanced structured data
  const breadcrumbs = [
    { name: "Topics", url: `${window.location.origin}/topics` },
    { name: topic?.title || '', url: `${window.location.origin}/topics/${slug}` },
    { name: "Archive", url: `${window.location.origin}/topics/${slug}/archive` },
    { name: formattedDate, url: canonical }
  ];

  const itemListItems = dailyItems?.map((item, index) => ({
    name: item.title,
    url: item.href,
    image: item.imageUrl,
    description: item.summary
  })) || [];

  const jsonLd = {
    ...itemListJsonLd(
      `${topic?.title} - ${formattedDate}`,
      `Daily content drop for ${topic?.title} on ${formattedDate}`,
      canonical,
      itemListItems
    ),
    "datePublished": date,
    "breadcrumb": breadcrumbJsonLd(breadcrumbs)
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
        noindex={isOld}
        jsonLd={jsonLd}
      />

      {archive && (
        <ArchiveNav
          slug={slug}
          selectedDate={date}
          availableDates={archive.availableDates}
        />
      )}

      <div className="container mx-auto px-4 py-8">
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
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>{topic?.title}</span>
            <span>•</span>
            <span>{formattedDate}</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Daily Drop on {topic?.title}
          </h1>
          {articleCount > 0 && (
            <div className="text-sm text-muted-foreground">
              {articleCount} article{articleCount !== 1 ? 's' : ''}
              {videoCount > 0 && ` • ${videoCount} video${videoCount !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        {topic && (
          <div className="mb-8">
            <TopicCtaBar
              topicId={1}
              topicSlug={slug}
              topicTitle={topic.title}
              pageTitle={title}
              pageUrl={canonical}
            />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : dailyItems && dailyItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dailyItems.map((item, index) => (
              <FeedCard
                key={item.id}
                {...item}
                user={user}
                onEngage={handleEngage}
                position={index}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No content available for this date.</p>
          </div>
        )}
      </div>
    </>
  );
};