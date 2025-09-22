import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { ArchiveNav } from "@/components/ArchiveNav";
import { ArchiveList } from "@/components/ArchiveList";
import { TopicCtaBar } from "@/components/topics/TopicCtaBar";
import { Skeleton } from "@/components/ui/skeleton";
import { getTopicArchive, getTopicData } from "@/lib/api/topics";
import { useAnalytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffect } from "react";
import { breadcrumbJsonLd, collectionPageJsonLd, itemListJsonLd } from "@/lib/seo";

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

      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {topic?.title} Archive
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Catch up on curated Drops for {topic?.title}. Browse past days, articles & videos.
            </p>
          </div>

          {/* CTA Bar */}
          <TopicCtaBar
            topicId={1}
            topicSlug={slug}
            topicTitle={topic?.title || ''}
            pageTitle={pageTitle}
            pageUrl={canonical}
          />
        </div>
      </div>

      {archive && (
        <ArchiveNav
          slug={slug}
          availableDates={archive.availableDates}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="border rounded-lg p-4">
                    <Skeleton className="h-6 w-64 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
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

          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Follow & Share</h3>
                <TopicCtaBar
                  topicId={1}
                  topicSlug={slug}
                  topicTitle={topic?.title || ''}
                  pageTitle={pageTitle}
                  pageUrl={canonical}
                  className="flex-col items-start gap-3"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};