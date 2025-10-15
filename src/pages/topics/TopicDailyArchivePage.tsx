import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { DailyDrop } from "@/components/DailyDrop";
import { ArchiveNav } from "@/components/ArchiveNav";
import { TopicCtaBar } from "@/components/topics/TopicCtaBar";
import { Skeleton } from "@/components/ui/skeleton";
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
    queryKey: ['topic-archive', slug],
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
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4 border rounded-lg p-4">
                <Skeleton className="h-20 w-20 flex-shrink-0 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : dailyItems && dailyItems.length > 0 ? (
          <div className="space-y-3">
            {dailyItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 bg-background hover:shadow-md transition-shadow">
                <div className="flex gap-3">
                  {/* Image */}
                  <div className="flex-shrink-0 w-20 h-20 bg-muted rounded overflow-hidden">
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <a 
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-foreground hover:text-primary transition-colors text-sm leading-tight line-clamp-2 block mb-2"
                    >
                      {item.title}
                    </a>
                    
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="truncate">{item.source.name}</span>
                      <span>•</span>
                      <time dateTime={item.publishedAt} className="whitespace-nowrap">
                        {new Date(item.publishedAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </time>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.summary}
                    </p>
                    
                    <div className="flex gap-1 flex-wrap">
                      {item.tags.slice(0, 1).map((tag, index) => (
                        <span key={index} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
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