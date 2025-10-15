import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Brain, Building, Palette, TrendingUp, Globe, Heart, Users, ExternalLink, CircleHelp as HelpCircle } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useIndexNow } from "@/lib/indexnow";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeThumbnailFromUrl, getYouTubeFallbackThumbnail } from "@/lib/youtube";
import { useTopicsMap } from "@/hooks/useTopicsMap";
import { ChipLink } from "@/components/ChipLink";
import { useAuth } from "@/hooks/useAuth";
import { HomePreview } from "@/components/HomePreview";
import { SignupStickyBar } from "@/components/SignupStickyBar";

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
      <div className="aspect-video bg-muted rounded-t-2xl overflow-hidden">
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
      <header className="bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-40"></div>
        <div className="container mx-auto px-4 py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-8">
              Your daily dose of AI, Tech & Business insights
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-16 max-w-3xl mx-auto">
              Cut through the noise. Stay updated.
            </p>
            
            <div className="flex justify-center">
              <Button size="lg" className="text-lg px-12 py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Home Preview Section */}
        <HomePreview />

        {/* SEO Intro Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-base text-muted-foreground leading-relaxed">
              Stay ahead with curated <strong>AI news</strong>, <strong>tech trends</strong>, and <strong>business intelligence</strong> delivered through our <strong>daily newsletter</strong>. 
              Our platform aggregates the most relevant insights from trusted sources, covering cutting-edge artificial intelligence developments, 
              startup innovations, and design breakthroughs. Join thousands of professionals who rely on our <strong>curated insights</strong> to make informed decisions. 
              Whether you're tracking emerging technologies or seeking strategic business perspectives, our expertly selected content 
              cuts through information overload and delivers genuine value to forward-thinking professionals.
            </p>
          </div>
        </section>

        {/* Topics Section */}
        <section className="bg-muted/20">
          <div className="container mx-auto px-4 py-28">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-16 text-center">
                Explore Topics
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {topics.map((topic) => (
                  <Card key={topic.id} className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-2 hover:scale-105 border-0 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-8 text-center">
                      <Link to={`/topics/${topic.slug}`} className="block">
                        <div className="flex flex-col items-center gap-6">
                          <div className="p-4 bg-primary/10 rounded-2xl text-primary">
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
              
              <div className="text-center mt-16">
                <Button variant="outline" className="rounded-2xl px-8" asChild>
                  <Link to="/topics">
                    View All Topics
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
          </div>
        </section>

      

        {/* FAQ Section */}
        <section className="bg-muted/20">
          <div className="container mx-auto px-4 py-28">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-16 text-center">
                Frequently Asked Questions
              </h2>
              
              <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="how-it-works" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      <span className="text-left font-semibold">How does DailyDrops work?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-muted-foreground">
                    DailyDrops curates the most relevant AI, tech, and business insights from trusted sources every day. 
                    Our intelligent system filters through thousands of articles, videos, and reports to bring you only 
                    what matters most. You can personalize your feed by following specific topics and receive updates 
                    through our daily newsletter or web platform.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="topics" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      <span className="text-left font-semibold">What topics can I follow?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-muted-foreground">
                    We cover a wide range of topics including Artificial Intelligence, Machine Learning, Business Strategy, 
                    Startups, Product Design, Finance, Technology Trends, and more. You can explore all available topics 
                    and customize your feed to match your professional interests and stay updated on the areas that matter most to you.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="curation" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      <span className="text-left font-semibold">How is the content curated?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-muted-foreground">
                    Our curation process combines advanced AI algorithms with editorial oversight to ensure quality and relevance. 
                    We analyze content from hundreds of trusted sources, evaluate engagement metrics, and apply intelligent filtering 
                    to surface the most impactful stories. This approach ensures you receive high-quality, timely insights without information overload.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="archive" className="border rounded-2xl px-6 bg-card/50 backdrop-blur-sm">
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      <span className="text-left font-semibold">Can I access past Drops?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-muted-foreground">
                    Yes! Our comprehensive archive allows you to browse past Drops by date and topic. 
                    You can explore historical content, track trends over time, and never miss important insights. 
                    The archive is fully searchable and organized by topics, making it easy to find specific content or 
                    discover related articles from previous days.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      <SignupStickyBar utmSource="home" utmCampaign="sticky_bar" />
    </div>
  );
};

export default Index;
