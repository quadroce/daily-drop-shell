import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { ArchiveNav } from "@/components/ArchiveNav";
import { ArchiveList } from "@/components/ArchiveList";
import { PremiumSidebar } from "@/components/PremiumSidebar";
import { TopicHeader } from "@/components/TopicHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getTopicArchive, getTopicData } from "@/lib/api/topics";
import { useAnalytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export const TopicArchiveIndexPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { track } = useAnalytics();
  const { session } = useAuth();

  // Mock user data - replace with real auth
  const user = { isPremium: new URLSearchParams(window.location.search).has('premium') };

  useEffect(() => {
    track('page_view', { page: 'topic_archive', slug });
  }, [slug, track]);

  const { data: topic } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => getTopicData(slug!),
    enabled: !!slug,
  });

  const { data: archive, isLoading, error } = useQuery({
    queryKey: ['topic-archive', slug],
    queryFn: () => getTopicArchive(slug!, user.isPremium),
    enabled: !!slug,
  });

  if (!slug) {
    return <Navigate to="/404" replace />;
  }

  if (error) {
    return <Navigate to="/404" replace />;
  }

  const canonical = `${window.location.origin}/topics/${slug}/archive`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${topic?.title} Archive`,
    "description": `Browse historical content and articles about ${topic?.title}`,
    "url": canonical,
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
          "item": canonical
        }
      ]
    }
  };

  return (
    <>
      <Seo
        title={`${topic?.title} Archive - Historical Content & News`}
        description={`Browse historical content and articles about ${topic?.title}. Access past drops and stay updated.`}
        canonical={canonical}
        jsonLd={jsonLd}
      />

      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <TopicHeader
            topicId={1} // TODO: Get actual topic ID
            topicSlug={slug}
            topicTitle={topic?.title || ''}
            topicIntro="Catch up on past curated Drops for this topic."
            level={1}
            showPreview={false}
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
                premiumLocked={!user.isPremium}
              />
            )}
          </div>

          <div className="lg:col-span-1">
            <PremiumSidebar
              title="Unlock unlimited archives with Premium"
              upgradeHref="/pricing"
            />
          </div>
        </div>
      </div>
    </>
  );
};