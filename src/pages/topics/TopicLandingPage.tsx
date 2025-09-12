import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { TopicCard } from "@/components/TopicCard";
import { ChipLink } from "@/components/ChipLink";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FeedCard } from "@/components/FeedCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Topic, getTopicWithChildren, buildBreadcrumb, getChildren, getTopicArticles } from "@/lib/topics";
import { useAnalytics } from "@/lib/analytics";
import { useEngagement } from "@/hooks/useEngagement";
import { useEffect } from "react";

export const TopicLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { track } = useAnalytics();

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
  const canonical = `${window.location.origin}/topics/${slug}`;
  const description = topic.intro 
    ? `${topic.intro.slice(0, 150)}${topic.intro.length > 150 ? '...' : ''}`
    : `Explore ${topic.label} - Level ${topic.level} topic with articles, subtopics and latest content`;

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
            {topic.intro && topic.level !== 3 && (
              <div className="mt-4 prose prose-sm max-w-none text-muted-foreground">
                <p>{topic.intro}</p>
              </div>
            )}
            {!topic.intro && topic.level === 3 && (
              <p className="mt-2">This is a specialized topic with focused content and discussions.</p>
            )}
            {!topic.intro && topic.level === 2 && (
              <p className="mt-2">Explore subtopics and specialized areas within {topic.label}.</p>
            )}
            {!topic.intro && topic.level === 1 && (
              <p className="mt-2">Browse all subtopics and specialized areas in {topic.label}.</p>
            )}
          </div>
        </header>

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
          // For L3: Show Subtopics first, then Articles (original order)
          <>
            {/* Children Topics */}
            {children.length > 0 ? (
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Related Topics
                  </h2>
                  <Button variant="outline" asChild>
                    <Link to={`/topics/${slug}/archive`}>View Archive</Link>
                  </Button>
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
            ) : (
              <section className="mb-12">
                <div className="bg-muted/30 rounded-2xl p-8 text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Specialized Topic
                  </h2>
                  <div className="text-muted-foreground mb-6">
                    {topic.intro ? (
                      <div className="prose prose-sm max-w-none mx-auto text-muted-foreground">
                        <p>{topic.intro}</p>
                      </div>
                    ) : (
                      <p>
                        This is a focused topic area. Content and discussions here dive deep into specific aspects of the subject.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-center gap-4">
                    <Button asChild>
                      <Link to={`/topics/${slug}/archive`}>View Archive</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to="/topics">Browse All Topics</Link>
                    </Button>
                  </div>
                </div>
              </section>
            )}

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
          </>
        )}
      </div>
    </>
  );
};