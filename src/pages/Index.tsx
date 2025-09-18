import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, Building, Palette, TrendingUp, Globe, Heart, Users, ExternalLink } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useIndexNow } from "@/lib/indexnow";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeThumbnailFromUrl, getYouTubeFallbackThumbnail } from "@/lib/youtube";

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
};

const Index = () => {
  const { submitCurrentPage } = useIndexNow();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [recentDrops, setRecentDrops] = useState<Drop[]>([]);

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
            id, title, summary, image_url, url, type, published_at,
            sources:source_id(name)
          `)
          .eq('tag_done', true)
          .gte('published_at', new Date().toISOString().split('T')[0])
          .order('published_at', { ascending: false })
          .limit(4);

        if (dropsError) throw dropsError;
        
        const formattedDrops = dropsData?.map((drop: any) => ({
          id: drop.id,
          title: drop.title,
          summary: drop.summary,
          image_url: drop.image_url,
          url: drop.url,
          type: drop.type,
          source_name: drop.sources?.name || 'Unknown Source',
          published_at: drop.published_at
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
                <Link to="/feed">
                  See Today's Drop
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
                {recentDrops.slice(0, 4).map((drop) => (
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
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {drop.summary}
                            </p>
                          )}
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
                <Link to="/feed">
                  Explore the full Drop
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} DropDaily</span>
              <span className="hidden md:inline">•</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">v2025.09</span>
            </div>
            
            <div className="flex items-center flex-wrap justify-center gap-4 md:gap-6 text-sm text-muted-foreground">
              <Link to="/topics" className="hover:text-primary transition-colors">
                Topics
              </Link>
              <Link to="/topics/technology/archive" className="hover:text-primary transition-colors">
                Archive
              </Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">
                Privacy
              </Link>
            </div>
          </div>
          
          <div className="text-center mt-6 pt-6 border-t border-muted">
            <p className="text-xs text-muted-foreground">
              Daily curated AI and tech news, delivered every morning.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
