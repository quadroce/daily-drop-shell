import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { ArchiveNav } from "@/components/ArchiveNav";
import { ArchiveList } from "@/components/ArchiveList";
import { TopicCtaBar } from "@/components/topics/TopicCtaBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { getTopicArchive, getTopicData } from "@/lib/api/topics";
import { useAnalytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffect } from "react";
import { breadcrumbJsonLd, collectionPageJsonLd, itemListJsonLd } from "@/lib/seo";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";

export const TopicArchiveIndexPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { track } = useAnalytics();
  const { session } = useAuth();
  const { isPremium } = useUserProfile();

  useEffect(() => {
    track('page_view', { 
      page: 'topic_archive', 
      slug,
      topic_slug: slug,
      location: 'archive_index'
    });
  }, [slug, track]);

  const { data: topic } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => getTopicData(slug!),
    enabled: !!slug,
  });

  const { data: archive, isLoading, error } = useQuery({
    queryKey: ['topic-archive', slug],
    queryFn: () => getTopicArchive(slug!, isPremium),
    enabled: !!slug,
  });

  if (!slug) {
    return <Navigate to="/404" replace />;
  }

  if (error) {
    return <Navigate to="/404" replace />;
  }

  const canonical = `${window.location.origin}/topics/${slug}/archive`;
  const pageTitle = `${topic?.title} Archive – Past DailyDrops`;
  const pageDescription = `Catch up on curated Drops for ${topic?.title}. Browse past days, articles & videos.`;

  // Enhanced structured data
  const breadcrumbs = [
    { name: "Topics", url: `${window.location.origin}/topics` },
    { name: topic?.title || '', url: `${window.location.origin}/topics/${slug}` },
    { name: "Archive", url: canonical }
  ];

  const jsonLd = collectionPageJsonLd(
    pageTitle,
    pageDescription,
    canonical,
    breadcrumbs
  );

  return (
    <>
      <Seo
        title={pageTitle}
        description={pageDescription}
        canonical={canonical}
        jsonLd={jsonLd}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-background via-muted/20 to-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="max-w-4xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <Link to="/topics" className="hover:text-foreground transition-colors">Topics</Link>
              <span>/</span>
              <Link to={`/topics/${slug}`} className="hover:text-foreground transition-colors">{topic?.title}</Link>
              <span>/</span>
              <span className="text-foreground">Archive</span>
            </nav>
            
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                {topic?.title} Archive
              </h1>
              <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed mb-6">
                <p className="text-xl">
                  Catch up on what you missed about <strong>{topic?.title}</strong>. 
                  Browse through our curated collection of daily drops, featuring the most relevant articles, 
                  insights, and updates from trusted sources.
                </p>
                <p>
                  Our archive spans up to 90 days of content, carefully organized by date to help you 
                  discover valuable information and stay informed on the latest developments in {topic?.title}.
                </p>
              </div>
            </div>

            {/* Mobile CTA Bar */}
            <div className="lg:hidden mb-8">
              <TopicCtaBar
                topicId={1}
                topicSlug={slug}
                topicTitle={topic?.title || ''}
                pageTitle={pageTitle}
                pageUrl={canonical}
                className="flex-wrap justify-center gap-2"
              />
            </div>
          </div>
        </div>
      </section>

      {archive && (
        <ArchiveNav
          slug={slug}
          availableDates={archive.availableDates}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="space-y-8">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-6 border-b border-border/50">
                        <div className="flex items-center gap-3 mb-4">
                          <Skeleton className="h-5 w-5 rounded" />
                          <div className="space-y-1">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[1, 2, 3].map(j => (
                            <div key={j} className="space-y-3">
                              <Skeleton className="aspect-video w-full rounded-lg" />
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : archive && (
              <ArchiveList
                slug={slug}
                days={archive.days}
                premiumLocked={!isPremium}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* CTA Card */}
              <Card className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-primary/10">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Stay Updated</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Follow this topic and get notified about new content, or subscribe to our RSS feed.
                  </p>
                  <TopicCtaBar
                    topicId={1}
                    topicSlug={slug}
                    topicTitle={topic?.title || ''}
                    pageTitle={pageTitle}
                    pageUrl={canonical}
                    className="flex-col items-stretch gap-3"
                  />
                </CardContent>
              </Card>

              {/* Archive Stats */}
              {archive && archive.days.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Archive Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Days</span>
                        <span className="font-semibold">{archive.days.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Items</span>
                        <span className="font-semibold">
                          {archive.days.reduce((sum, day) => sum + day.items.length, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Latest Update</span>
                        <span className="font-semibold text-sm">
                          {archive.days.length > 0 ? format(parseISO(archive.days[0].date), 'MMM d') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};