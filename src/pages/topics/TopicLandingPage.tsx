import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { TopicCard } from "@/components/TopicCard";
import { ChipLink } from "@/components/ChipLink";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FeedCard } from "@/components/FeedCard";
import { TopicHeader } from "@/components/TopicHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Topic, getTopicWithChildren, buildBreadcrumb, getChildren, getTopicArticles } from "@/lib/topics";
import { useAnalytics } from "@/lib/analytics";
import { useEngagement } from "@/hooks/useEngagement";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export const TopicLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { track } = useAnalytics();
  const { session } = useAuth();

  // Track engagement on this page
  useEngagement();

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

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['topic-articles', slug],
    queryFn: () => getTopicArticles(slug!),
    enabled: !!slug,
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
  
  // Use production domain for consistent sharing
  const baseUrl = 'https://dailydrops.cloud';
  const canonical = `${baseUrl}/topics/${slug}`;
  const description = topic.intro 
    ? `${topic.intro.slice(0, 150)}${topic.intro.length > 150 ? '...' : ''}`
    : `Explore ${topic.label} - Level ${topic.level} topic with articles, subtopics and latest content`;
  
  // Determine og:image for social sharing - use DailyDrops branded image as fallback
  const defaultOgImage = `${baseUrl}/og-dailydrops.jpg`;
  const ogImage = articles && articles.length > 0 && articles[0].imageUrl
    ? (articles[0].imageUrl.startsWith('http') ? articles[0].imageUrl : `${baseUrl}${articles[0].imageUrl}`)
    : defaultOgImage;

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
        "item": item.to ? `${baseUrl}${item.to}` : canonical
      })) || []
    }
  };

  return (
    <>
      <Seo
        title={`${topic.label} - Topics`}
        description={description}
        canonical={canonical}
        ogImage={ogImage}
        ogType="article"
        jsonLd={jsonLd}
      />
      
      <div className="container mx-auto px-4 py-8">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        
        <TopicHeader
          topicId={topic.id}
          topicSlug={topic.slug}
          topicTitle={topic.label}
          topicIntro={topic.intro}
          level={topic.level}
          showPreview={!session && (articles?.length || 0) > 0}
        />

        {/* For L1 and L2: Show Articles first, then Subtopics */}
        {(topic.level === 1 || topic.level === 2) ? (
          <>
            {/* Topic Articles */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-foreground">
                  Latest from {topic.label}
                </h2>
                <Button variant="outline" asChild>
                  <Link to={`/topics/${slug}/archive`}>View Archive</Link>
                </Button>
              </div>
              
              {articlesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-video rounded-lg" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : articles && articles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map(article => (
                    <FeedCard
                      key={article.id}
                      {...article}
                      onEngage={(action) => {
                        track('open_item', { 
                          itemId: action.itemId, 
                          topic: slug,
                          action: action.action
                        });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-2xl p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No articles found for this topic yet. Check back soon!
                  </p>
                  <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    Follow Topic for Updates
                  </button>
                </div>
              )}
            </section>

            {/* Children Topics */}
            {children.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {topic.level === 1 ? "Subtopics" : "Related Topics"}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {children.map(child => (
                    <div key={child.id.toString()} className="space-y-3">
                      <TopicCard
                        to={`/topics/${child.slug}`}
                        label={child.label}
                        intro={child.intro}
                        level={child.level}
                      />
                      
                      {/* Show L3 children for L1 topics */}
                      {topic.level === 1 && grandchildrenByParent?.[child.id.toString()]?.length > 0 && (
                        <div className="pl-2 pt-2 border-l-2 border-muted/30">
                          <div className="flex flex-wrap gap-2 pl-2">
                            {grandchildrenByParent[child.id.toString()].map((grandchild: Topic) => (
                              <ChipLink 
                                key={grandchild.id.toString()} 
                                to={`/topics/${grandchild.slug}`}
                                variant="tag-l3"
                              >
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
            )}
          </>
        ) : (
          // For L3: Show Subtopics first, then Articles
          <>
            {/* Children Topics */}
            {children.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Related Topics
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {children.map(child => (
                    <TopicCard
                      key={child.id.toString()}
                      to={`/topics/${child.slug}`}
                      label={child.label}
                      intro={child.intro}
                      level={child.level}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Topic Articles */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-foreground">
                  Latest from {topic.label}
                </h2>
              </div>
              
              {articlesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-video rounded-lg" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : articles && articles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map(article => (
                    <FeedCard
                      key={article.id}
                      {...article}
                      onEngage={(action) => {
                        track('open_item', { 
                          itemId: action.itemId, 
                          topic: slug,
                          action: action.action
                        });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-2xl p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No articles found for this topic yet. Check back soon!
                  </p>
                  <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    Follow Topic for Updates
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
};