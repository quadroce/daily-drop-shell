import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Clock, Zap, Archive, Shield, Star, CheckCircle, ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";

const Premium = () => {
  // TODO: Connect to Stripe for Premium upgrade
  // TODO: Implement upgrade flow and subscription management

  const premiumFeatures = [
    {
      icon: <Smartphone className="h-6 w-6 text-primary" />,
      title: "WhatsApp Delivery",
      description: "Receive curated drops directly on WhatsApp, twice daily",
      details: [
        "Morning drop at 08:00 CET",
        "Evening drop at 18:00 CET",
        "Instant access on your phone",
        "No app switching required"
      ]
    },
    {
      icon: <Zap className="h-6 w-6 text-primary" />,
      title: "Advanced Personalization",
      description: "Smarter AI that learns from your reading patterns",
      details: [
        "Machine learning algorithms",
        "Reading time analysis",
        "Topic refinement over time",
        "Behavioral pattern recognition"
      ]
    },
    {
      icon: <Archive className="h-6 w-6 text-primary" />,
      title: "Content Archive",
      description: "Access your complete history of drops and interactions",
      details: [
        "Full search functionality",
        "Export your data",
        "Historical trend analysis",
        "Unlimited storage"
      ]
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: "Ad-Free Experience",
      description: "No sponsored content, just pure curated drops",
      details: [
        "Zero sponsored posts",
        "Clean reading experience",
        "No distractions",
        "Focus on quality content"
      ]
    }
  ];

  const whatsappSchedule = [
    {
      time: "08:00 CET",
      title: "Morning Drop",
      description: "Start your day with fresh insights",
      content: [
        "Overnight tech developments",
        "Market updates & analysis",
        "Trending conversations",
        "Must-read articles"
      ]
    },
    {
      time: "18:00 CET", 
      title: "Evening Drop",
      description: "Unwind with curated discoveries",
      content: [
        "In-depth long reads",
        "Creative inspiration",
        "Weekend project ideas",
        "Thoughtful discussions"
      ]
    }
  ];

  return (
    <>
      <Seo
        title="DailyDrops Premium - WhatsApp Delivery & Advanced Features"
        description="Upgrade to Premium for WhatsApp content delivery, advanced personalization, ad-free experience, and full content archive access. €9/month with no commitment."
        canonical="https://dailydrops.cloud/premium"
        ogImage="https://dailydrops.cloud/og-premium.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "DailyDrops Premium",
          "description": "Premium content curation service with WhatsApp delivery and advanced personalization",
          "brand": {
            "@type": "Organization",
            "name": "DailyDrops"
          },
          "offers": {
            "@type": "Offer",
            "price": "9",
            "priceCurrency": "EUR",
            "priceValidUntil": "2025-12-31",
            "availability": "https://schema.org/InStock",
            "url": "https://dailydrops.cloud/premium"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": "247"
          }
        }}
      />
      <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              <Star className="h-3 w-3 mr-1" />
              Premium Experience
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              DailyDrops Premium
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Get your personalized content delivered directly to WhatsApp, 
              with advanced AI personalization and an ad-free experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" disabled>
                Upgrade to Premium
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8">
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Delivery Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              WhatsApp Delivery Schedule
            </h2>
            <p className="text-muted-foreground text-lg">
              Two perfectly timed drops to fit your daily rhythm
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {whatsappSchedule.map((schedule, index) => (
              <Card key={index} className="bg-card hover:bg-card-hover transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{schedule.title}</CardTitle>
                      <CardDescription className="text-primary font-medium">
                        {schedule.time}
                      </CardDescription>
                    </div>
                  </div>
                  <p className="text-muted-foreground">{schedule.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {schedule.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Premium Features
              </h2>
              <p className="text-muted-foreground text-lg">
                Everything you need for the perfect content discovery experience
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {premiumFeatures.map((feature, index) => (
                <Card key={index} className="bg-card">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {feature.icon}
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </div>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-success" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing CTA */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Ready to Upgrade?
              </h3>
              <p className="text-muted-foreground mb-6 text-lg">
                Join thousands of users who get their daily insights delivered directly to WhatsApp
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">€9</div>
                  <div className="text-sm text-muted-foreground">per month</div>
                </div>
                <div className="hidden sm:block text-muted-foreground">•</div>
                <div className="text-center">
                  <div className="text-lg font-medium">No commitment</div>
                  <div className="text-sm text-muted-foreground">Cancel anytime</div>
                </div>
                <div className="hidden sm:block text-muted-foreground">•</div>
                <div className="text-center">
                  <div className="text-lg font-medium">Instant access</div>
                  <div className="text-sm text-muted-foreground">Setup in minutes</div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8" disabled>
                  Start Premium Now
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8">
                  Compare All Plans
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                30-day money-back guarantee • Secure payment via Stripe
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
};

export default Premium;