import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { TopicCard } from "@/components/TopicCard";
import { ChipLink } from "@/components/ChipLink";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Topic, getTopicWithChildren, buildBreadcrumb, getChildren } from "@/lib/topics";
import { useAnalytics } from "@/lib/analytics";
import { useEffect } from "react";

export const TopicLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { track } = useAnalytics();

  useEffect(() => {
    track('page_view', { page: 'topic_landing', slug });
  }, [slug, track]);

  const { data: topicData, isLoading: topicLoading, error: topicError } = useQuery({
    queryKey: ['topic-with-children', slug],
    queryFn: () => getTopicWithChildren(slug!),
    enabled: !!slug,
  });

  const { data: breadcrumb, isLoading: breadcrumbLoading } = useQuery({
    queryKey: ['topic-breadcrumb', slug],
    queryFn: () => topicData ? buildBreadcrumb(topicData.topic) : Promise.resolve([]),
    enabled: !!topicData,
  });

  const { data: grandchildrenByParent, isLoading: grandchildrenLoading } = useQuery({
    queryKey: ['grandchildren-by-parent', slug],
    queryFn: async () => {
      if (!topicData || topicData.topic.level !== 1) return {};
      
      const grandchildrenMap: Record<string, Topic[]> = {};
      for (const child of topicData.children) {
        const grandchildren = await getChildren(child.id);
        grandchildrenMap[child.id.toString()] = grandchildren;
      }
      return grandchildrenMap;
    },
    enabled: !!topicData && topicData.topic.level === 1,
  });

  if (!slug) {
    return <Navigate to="/404" replace />;
  }

  if (topicError) {
    return <Navigate to="/404" replace />;
  }

  if (topicLoading || breadcrumbLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <Skeleton className="h-6 w-64" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-96" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!topicData) return null;

  const { topic, children } = topicData;
  const canonical = `${window.location.origin}/topics/${slug}`;
  const description = `Learn about ${topic.label}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": topic.label,
    "description": description,
    "url": canonical,
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumb?.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.label,
        "item": item.to ? `${window.location.origin}${item.to}` : canonical
      })) || []
    }
  };

  return (
    <>
      <Seo
        title={`${topic.label} - Topics`}
        description={description}
        canonical={canonical}
        jsonLd={jsonLd}
      />
      
      <div className="container mx-auto px-4 py-8">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">{topic.label}</h1>
          <div className="text-muted-foreground mb-4">
            <p>Level {topic.level} topic</p>
            {topic.level === 3 && (
              <p className="mt-2">This is a specialized topic with focused content and discussions.</p>
            )}
            {topic.level === 2 && (
              <p className="mt-2">Explore subtopics and specialized areas within {topic.label}.</p>
            )}
            {topic.level === 1 && (
              <p className="mt-2">Browse all subtopics and specialized areas in {topic.label}.</p>
            )}
          </div>
        </header>

        {/* Children Topics */}
        {children.length > 0 ? (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              {topic.level === 1 ? "Subtopics" : "Related Topics"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {children.map(child => (
                <div key={child.id.toString()} className="space-y-3">
                  <TopicCard
                    to={`/topics/${child.slug}`}
                    label={child.label}
                    intro={null}
                    level={child.level}
                  />
                  
                  {/* Show L3 children for L1 topics */}
                  {topic.level === 1 && grandchildrenByParent?.[child.id.toString()]?.length > 0 && (
                    <div className="pl-4">
                      <div className="flex flex-wrap gap-2">
                        {grandchildrenByParent[child.id.toString()].map((grandchild: Topic) => (
                          <ChipLink key={grandchild.id.toString()} to={`/topics/${grandchild.slug}`}>
                            {grandchild.label}
                          </ChipLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-12">
            <div className="bg-muted/30 rounded-2xl p-8 text-center">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {topic.level === 3 ? "Specialized Topic" : "Topic Details"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {topic.level === 3 
                  ? "This is a focused topic area. Content and discussions here dive deep into specific aspects of the subject."
                  : "This topic area is currently being organized. Check back soon for more content."
                }
              </p>
              <div className="flex justify-center gap-4">
                <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Follow Topic
                </button>
                <button className="px-6 py-2 border border-border rounded-lg hover:bg-accent transition-colors">
                  Browse Related
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
};