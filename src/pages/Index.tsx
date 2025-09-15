import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, Smartphone, Users, Building, TrendingUp, ArrowRight, CheckCircle, Clock, Shield, Target, Zap } from "lucide-react";
import { Seo } from "@/components/Seo";

const Index = () => {
  const whyProfessionalsLove = [
    {
      icon: <Clock className="h-6 w-6 text-primary" />,
      title: "Time-saving",
      description: "No more endless scrolling. One Drop, every day."
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: "High-signal sources", 
      description: "Content comes from trusted publishers, research outlets, and verified creators."
    },
    {
      icon: <Target className="h-6 w-6 text-primary" />,
      title: "Personalized",
      description: "Your preferences and interactions shape what you see next."
    },
    {
      icon: <Zap className="h-6 w-6 text-primary" />,
      title: "Independent",
      description: "Free from opaque algorithms that serve ads instead of value."
    }
  ];

  const features = [
    "Daily curated feed (5–10 items)",
    "Built-in feedback: save, like, dismiss",
    "Newsletter delivery straight to your inbox",
    "Premium WhatsApp delivery (twice a day)",
    "Professional topic taxonomy (AI & ML, Design, Product, Startups, more)",
    "Public topic pages for SEO and evergreen discovery",
    "Archive access (90 days Free, unlimited Premium)"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Seo 
        title="DailyDrops – Curated AI, Tech & Business News for Professionals"
        description="Get your Daily Drop: curated AI, tech and business insights tailored for busy professionals. Free and premium plans available."
        canonical="https://dailydrops.cloud/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "url": "https://dailydrops.cloud/",
          "name": "DailyDrops",
          "description": "Curated AI, tech and business insights tailored for busy professionals.",
          "publisher": {
            "@type": "Organization",
            "name": "DailyDrops",
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
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/20 text-primary border-primary/30">
              ✨ Fresh Professional Insights, Every Day
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              DailyDrops – Fresh Professional Insights, Every Day
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Take control of your feed. Get curated AI, tech and business insights without algorithmic manipulation.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" asChild>
                <Link to="/auth">
                  Get your first Daily Drop today – free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8" asChild>
                <Link to="/feed">
                  Browse Sample Feed
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Choose What to Read Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Choose What to Read, When You Want
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
            <p>
              In a digital world dominated by algorithmic feeds designed to manipulate your attention, DailyDrops gives you back control. No hidden agenda, no endless scroll, no manipulation. Every morning, you receive a curated selection of high-signal content: articles, reports, and videos that matter to professionals. You decide what to read, when to read it, and how to act on it.
            </p>
          </div>
        </div>
      </div>

      {/* What is DailyDrops Section */}
      <div className="bg-muted/30">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              What is DailyDrops?
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
              <p>
                DailyDrops is a content curation platform built for busy professionals who don't have time to sift through noise. Instead of dozens of low-value posts, you get a concise Drop: 5–10 hand-selected pieces, refreshed daily. Each Drop includes at least one YouTube video, giving you multiple formats to engage with.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Why Professionals Love It Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
            Why Professionals Love It
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {whyProfessionalsLove.map((reason, index) => (
              <Card key={index} className="hover:bg-card-hover transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      {reason.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">{reason.title}</h3>
                      <p className="text-muted-foreground">{reason.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features at a Glance Section */}
      <div className="bg-muted/30">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
              Features at a Glance
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3 bg-background/50 p-4 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Who is it for Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Who is it for?
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed">
            <p>
              DailyDrops is built for knowledge workers, startup founders, product managers, designers, researchers, and anyone who values their time. Whether you are preparing for a client call, scanning industry trends, or simply staying sharp, DailyDrops ensures you get the essentials without distraction.
            </p>
          </div>
        </div>
      </div>

      {/* Take Control Section */}
      <div className="bg-muted/30">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Take Control of Your Feed
            </h2>
            <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed mb-8">
              <p>
                The most radical act in today's digital landscape is choosing what you read. DailyDrops makes that choice easy and powerful. Sign up today, set your interests, and start receiving a curated drop of insights every morning.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" asChild>
                <Link to="/auth">
                  Get your first Daily Drop today – free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8" asChild>
                <Link to="/feed">
                  Browse Sample Feed
                </Link>
              </Button>  
            </div>
          </div>
        </div>  
      </div>

      {/* Final CTA Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-12 text-center">
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Free forever plan</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
