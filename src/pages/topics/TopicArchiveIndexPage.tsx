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
import { SignupStickyBar } from "@/components/SignupStickyBar";

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
    queryKey: ['topic-archive', slug, isPremium],
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

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/topics" className="hover:text-foreground transition-colors">Topics</Link>
          <span>/</span>
          <Link to={`/topics/${slug}`} className="hover:text-foreground transition-colors">{topic?.title}</Link>
          <span>/</span>
          <span className="text-foreground">Archive</span>
        </nav>

        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {topic?.title} Archive
          </h1>
          <div className="prose prose-lg text-muted-foreground max-w-none">
            <p>
              Catch up on what you missed about{" "}
              <span className="font-semibold text-foreground">{topic?.title}</span>. Browse
              through our curated collection of daily drops, featuring the most relevant articles,
              insights, and updates from trusted sources.
            </p>
            <p className="text-sm mt-4">
              Our archive spans up to 90 days of content, carefully organized by date to help you
              discover valuable information and stay informed on the latest developments in{" "}
              {topic?.title}.
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        {topic && (
          <div className="mb-8">
            <TopicCtaBar
              topicId={1}
              topicSlug={slug}
              topicTitle={topic.title}
              pageTitle={pageTitle}
              pageUrl={canonical}
              className="flex-wrap gap-2"
            />
          </div>
        )}

        {/* Archive Stats */}
        {archive && archive.days.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-6 mb-8 max-w-2xl">
            <h3 className="font-semibold text-foreground mb-4">Archive Stats</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {archive.days.length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Total Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {archive.days.reduce((sum, day) => sum + day.items.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Total Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {archive.days.length > 0 ? format(parseISO(archive.days[0].date), 'MMM d') : 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Latest Update</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        {archive && (
          <ArchiveNav
            slug={slug}
            availableDates={archive.availableDates}
          />
        )}

        {/* Archive Content */}
        <div className="mt-8">
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
      </div>

      <SignupStickyBar scrollThreshold={400} utmSource="archive" utmCampaign="sticky_bar" />
    </>
  );
};