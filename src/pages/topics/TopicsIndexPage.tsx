import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { TopicCard } from "@/components/TopicCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllTopics, groupTopicsByLevel } from "@/lib/topics";
import { useAnalytics } from "@/lib/analytics";
import { useEffect } from "react";

export const TopicsIndexPage = () => {
  const { track } = useAnalytics();

  useEffect(() => {
    track('page_view', { page: 'topics_index' });
  }, [track]);

  const { data: topics, isLoading, error } = useQuery({
    queryKey: ['all-topics'],
    queryFn: getAllTopics,
  });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Topics</h1>
        <p className="text-muted-foreground">Failed to load topics. Please try again later.</p>
      </div>
    );
  }

  const canonical = `${window.location.origin}/topics`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Topics",
    "description": "Browse all topics and subtopics.",
    "url": canonical,
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": topics?.map((topic, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Thing",
          "name": topic.label,
          "url": `${window.location.origin}/topics/${topic.slug}`
        }
      })) || []
    }
  };

  const groupedTopics = topics ? groupTopicsByLevel(topics) : {};

  return (
    <>
      <Seo
        title="Topics | DailyDrops"
        description="Browse all topics and subtopics."
        canonical={canonical}
        jsonLd={jsonLd}
      />
      
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Topics</h1>
          <p className="text-muted-foreground">
            Explore our comprehensive collection of topics and their subtopics.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-8">
            {[1, 2, 3].map(level => (
              <section key={level}>
                <Skeleton className="h-8 w-32 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-12">
            {[1, 2, 3].map(level => {
              const levelTopics = groupedTopics[level] || [];
              if (levelTopics.length === 0) return null;

              const levelTitle = {
                1: "Main Topics",
                2: "Subtopics", 
                3: "Specialized Topics"
              };

              return (
                <section key={level}>
                  <h2 className="text-2xl font-semibold text-foreground mb-6">
                    {levelTitle[level as keyof typeof levelTitle]} ({levelTopics.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {levelTopics.map(topic => (
                      <TopicCard
                        key={topic.id.toString()}
                        to={`/topics/${topic.slug}`}
                        label={topic.label}
                        intro={null}
                        level={topic.level}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};