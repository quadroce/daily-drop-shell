import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { TopicIntro } from "@/components/TopicIntro";
import { CtaBanner } from "@/components/CtaBanner";
import { TopicFeedPreview } from "@/components/TopicFeedPreview";
import { Skeleton } from "@/components/ui/skeleton";
import { getTopicData, getTopicPreview } from "@/lib/api/topics";
import { useAnalytics } from "@/lib/analytics";
import { useEffect } from "react";

export const TopicLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { track } = useAnalytics();

  useEffect(() => {
    track('page_view', { page: 'topic_landing', slug });
  }, [slug, track]);

  const { data: topic, isLoading: topicLoading, error: topicError } = useQuery({
    queryKey: ['topic', slug],
    queryFn: () => getTopicData(slug!),
    enabled: !!slug,
  });

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['topic-preview', slug],
    queryFn: () => getTopicPreview(slug!),
    enabled: !!slug,
  });

  if (!slug) {
    return <Navigate to="/404" replace />;
  }

  if (topicError) {
    return <Navigate to="/404" replace />;
  }

  if (topicLoading) {
    return (
      <div className="space-y-8">
        <div className="py-8 px-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-12 w-96" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  const canonical = `${window.location.origin}/topics/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": topic?.title,
    "description": topic?.introHtml.replace(/<[^>]*>/g, '').substring(0, 160),
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
          "item": canonical
        }
      ]
    }
  };

  return (
    <>
      <Seo
        title={`${topic?.title} - Latest Updates & News`}
        description={topic?.introHtml.replace(/<[^>]*>/g, '').substring(0, 160)}
        canonical={canonical}
        jsonLd={jsonLd}
      />
      
      {topic && (
        <TopicIntro 
          title={topic.title}
          introHtml={topic.introHtml}
          slug={topic.slug}
        />
      )}

      <CtaBanner
        headline="Get the full Drop delivered every morning – sign up free"
        primaryLabel="Sign up"
        href="/auth"
        variant="signup"
      />

      {previewLoading ? (
        <div className="py-8 px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-32 w-48 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : preview && (
        <TopicFeedPreview items={preview} slug={slug} />
      )}
    </>
  );
};