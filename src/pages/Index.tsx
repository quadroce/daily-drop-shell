import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, Building, Palette, TrendingUp, Globe, Heart, Users, ExternalLink } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useIndexNow } from "@/lib/indexnow";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeThumbnailFromUrl, getYouTubeFallbackThumbnail } from "@/lib/youtube";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { ChipLink } from "@/components/ChipLink";
import { useAuth } from "@/hooks/useAuth";

// Types for our data
type Topic = {
  id: number;
  slug: string;
  label: string;
  level: number;
};

type Drop = {
  id: number;
  title: string;
  summary: string | null;
  image_url: string | null;
  url: string;
  type: string;
  source_name: string | null;
  published_at: string;
  l1_topic: { slug: string; label: string } | null;
  l2_topic: { slug: string; label: string } | null;
  tags: string[];
};

const Index = () => {
  const { submitCurrentPage } = useIndexNow();
  const { getTopicSlug, isLoading: topicsLoading } = useTopicsMap();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [recentDrops, setRecentDrops] = useState<Drop[]>([]);

  // Redirect authenticated users to feed
  useEffect(() => {
    if (user) {
      navigate("/feed");
    }
  }, [user, navigate]);

  // Submit to IndexNow for rapid discovery
  useEffect(() => {
    submitCurrentPage();
  }, [submitCurrentPage]);

  // Fetch topics and recent drops
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch main topics (level 1)
        const { data: topicsData, error: topicsError } = await supabase
          .from('topics')
          .select('id, slug, label, level')
          .eq('level', 1)
          .eq('is_active', true)
          .order('label')
          .limit(8);

        if (topicsError) throw topicsError;
        setTopics(topicsData || []);

        // Fetch recent drops from today
        const { data: dropsData, error: dropsError } = await supabase
          .from('drops')
          .select(`
            id, title, summary, image_url, url, type, published_at, tags,
            sources:source_id(name),
            l1_topic:l1_topic_id(slug, label),
            l2_topic:l2_topic_id(slug, label)
          `)
          .eq('tag_done', true)
          .gte('published_at', new Date().toISOString().split('T')[0])
          .order('published_at', { ascending: false })
          .limit(8);

        if (dropsError) throw dropsError;
        
        const formattedDrops = dropsData?.map((drop: any) => ({
          id: drop.id,
          title: drop.title,
          summary: drop.summary,
          image_url: drop.image_url,
          url: drop.url,
          type: drop.type,
          source_name: drop.sources?.name || 'Unknown Source',
          published_at: drop.published_at,
          l1_topic: drop.l1_topic,
          l2_topic: drop.l2_topic,
          tags: drop.tags || []
        })) || [];
        
        setRecentDrops(formattedDrops);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // Topic icons mapping
  const getTopicIcon = (slug: string) => {
    switch (slug) {
      case 'technology': return <Brain className="h-6 w-6" />;
      case 'business': return <Building className="h-6 w-6" />;
      case 'design': return <Palette className="h-6 w-6" />;
      case 'finance': return <TrendingUp className="h-6 w-6" />;
      case 'media': return <Globe className="h-6 w-6" />;
      case 'science': return <Heart className="h-6 w-6" />;
      case 'lifestyle': return <Heart className="h-6 w-6" />;
      case 'society': return <Users className="h-6 w-6" />;
      default: return <Globe className="h-6 w-6" />;
    }
  };

  // YouTube thumbnail component with fallback
  const YouTubeThumbnail = ({ drop }: { drop: Drop }) => {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
      if (drop.image_url) {
        setImageSrc(drop.image_url);
      } else if (drop.type === 'video') {
        const thumbnail = getYouTubeThumbnailFromUrl(drop.url);
        if (thumbnail) {
          setImageSrc(thumbnail);
        }
      }
    }, [drop]);

    const handleImageError = () => {
      if (!imageError && drop.type === 'video') {
        const fallbackThumbnail = getYouTubeFallbackThumbnail(drop.url);
        if (fallbackThumbnail) {
          setImageSrc(fallbackThumbnail);
          setImageError(true);
        }
      }
    };

    if (!imageSrc) return null;

    return (
      <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
        <img 
          src={imageSrc}
          alt={drop.title}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo 
        title="Your Daily Dose of AI, Tech & Business Insights - DropDaily"
        description="Cut through the noise with curated AI news, tech trends, and business intelligence. Daily newsletter with startup insights, design updates, and professional content."
        canonical="https://dailydrops.cloud/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "url": "https://dailydrops.cloud/",
          "name": "DropDaily",
          "description": "Your daily dose of AI, Tech & Business insights. Cut through the noise with curated content.",
          "publisher": {
            "@type": "Organization",
            "name": "DropDaily",
            "logo": {
              "@type": "ImageObject",
              "url": "https://dailydrops.cloud/logo.png"
            }
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://dailydrops.cloud/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />

      {/* Hero Section */}
      <header className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Your daily dose of AI, Tech & Business insights
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Cut through the noise. Stay updated in minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" asChild>
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8" asChild>
                <Link to="/newsletter">
                  Subscribe Free
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* SEO Intro Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Stay ahead with curated <strong>AI news</strong>, <strong>tech trends</strong>, and <strong>business intelligence</strong> delivered through our <strong>daily newsletter</strong>. 
              Our platform aggregates the most relevant insights from trusted sources, covering everything from cutting-edge artificial intelligence developments 
              to startup innovations and design breakthroughs. Join thousands of professionals who rely on our <strong>curated insights</strong> to make informed decisions. 
              Whether you're tracking emerging technologies, monitoring industry shifts, or seeking strategic business perspectives, our expertly selected content 
              cuts through information overload. Get comprehensive coverage of <strong>startups</strong>, product design evolution, and market analysis 
              that matters to forward-thinking professionals. Transform how you consume professional content with intelligence-driven curation that respects your time and delivers genuine value.
            </p>
          </div>
        </section>

        {/* Topics Section */}
        <section className="bg-muted/30">
          <div className="container mx-auto px-4 py-24">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
                Explore Topics
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {topics.map((topic) => (
                  <Card key={topic.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                    <CardContent className="p-6 text-center">
                      <Link to={`/topics/${topic.slug}`} className="block">
                        <div className="flex flex-col items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-full text-primary">
                            {getTopicIcon(topic.slug)}
                          </div>
                          <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                            {topic.label}
                          </h3>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="text-center mt-12">
                <Button variant="outline" asChild>
                  <Link to="/topics">
                    View All Topics
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Daily Preview Section */}
        <section className="container mx-auto px-4 py-24">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
              Today's Featured Drops
            </h2>
            
            {recentDrops.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {recentDrops.map((drop) => (
                  <Card key={drop.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                    <CardContent className="p-0">
                      <a href={drop.url} target="_blank" rel="noopener noreferrer" className="block">
                        <YouTubeThumbnail drop={drop} />
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {drop.type === 'video' ? '📹' : '📄'} {drop.source_name}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-foreground mb-2 line-clamp-2 hover:text-primary transition-colors">
                            {drop.title}
                          </h3>
                          {drop.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {drop.summary}
                            </p>
                          )}
                          
                          {/* Topic Tags */}
                          <div className="flex flex-wrap gap-1 mb-3">
                            {drop.l1_topic && (
                              <ChipLink 
                                to={`/topics/${drop.l1_topic.slug}`} 
                                variant="tag-l1"
                                className="text-xs"
                              >
                                {drop.l1_topic.label}
                              </ChipLink>
                            )}
                            {drop.l2_topic && (
                              <ChipLink 
                                to={`/topics/${drop.l2_topic.slug}`} 
                                variant="tag-l2"
                                className="text-xs"
                              >
                                {drop.l2_topic.label}
                              </ChipLink>
                            )}
                            {drop.tags.slice(0, 2).map((tag) => {
                              const slug = getTopicSlug(tag);
                              return slug ? (
                                <ChipLink 
                                  key={tag}
                                  to={`/topics/${slug}`} 
                                  variant="tag-l3"
                                  className="text-xs"
                                >
                                  {tag}
                                </ChipLink>
                              ) : (
                                <Badge key={tag} variant="tag-l3" className="text-xs">
                                  {tag}
                                </Badge>
                              );
                            })}
                          </div>
                          
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(drop.published_at).toLocaleDateString()}
                            </span>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-6">Loading today's featured content...</p>
              </div>
            )}
            
            <div className="text-center">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Join to see more content
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
