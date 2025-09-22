import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Target, TrendingUp, Shield, Users, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";

const Personalization = () => {
  const faqData = [
    {
      question: "What is a vector embedding?",
      answer: "A vector embedding is like a mathematical 'fingerprint' for content and interests. Just as your fingerprint uniquely identifies you, an embedding uniquely represents topics, articles, and your preferences as numbers in a multi-dimensional space."
    },
    {
      question: "How does DailyDrops build my profile?",
      answer: "Your personalization profile is built through onboarding (selecting topics and languages), converting these into a unique vector stored securely, and continuous refinement as you interact with content."
    },
    {
      question: "How is my Daily Drop personalized?",
      answer: "Each article gets a personalized ranking score based on catalog score (quality + authority), topic match, vector similarity, and feedback signals, with content rules ensuring quality and variety."
    },
    {
      question: "What happens when I Like, Dismiss, or Save an item?",
      answer: "Every interaction helps improve your recommendations: likes boost similar content, saves provide the strongest positive signal, and dismissals help avoid unwanted topics."
    },
    {
      question: "Does personalization change over time?",
      answer: "Yes! The system adapts based on your engagement level, from cold start (relying on selected topics) to mature profiles with highly personalized recommendations."
    }
  ];

  return (
    <>
      <Seo
        title="How DailyDrops Personalization Works"
        description="Discover how DailyDrops uses AI vector embeddings, feedback signals, and topic preferences to personalize your curated feed every day."
        canonical="https://dailydrops.cloud/personalization"
        faq={faqData}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "How DailyDrops Personalization Works",
          "description": "Learn how AI-powered personalization works on DailyDrops",
          "url": "https://dailydrops.cloud/personalization"
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Brain className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">How DailyDrops Personalization Works</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Learn how our AI-powered system curates personalized content that gets smarter with every interaction.
          </p>
          <Card className="bg-muted/30 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-base leading-relaxed">
                DailyDrops uses <strong>AI vector embeddings</strong> to understand your interests and preferences. 
                Think of it as creating a unique "fingerprint" of your professional interests that helps us match 
                you with the most relevant AI, tech, and business content every day.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Visual Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <Target className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle className="text-lg">Smart Matching</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI analyzes your preferences to find content that matches your interests
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle className="text-lg">Continuous Learning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Every interaction improves your recommendations over time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Accordion */}
        <div className="mb-12">
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-4">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-semibold">What is a vector embedding?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  A vector embedding is like a mathematical "fingerprint" for content and interests. Just as your 
                  fingerprint uniquely identifies you, an embedding uniquely represents topics, articles, and your preferences 
                  as numbers in a multi-dimensional space.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  This allows our AI to measure how similar different pieces of content are to your interests. 
                  For example, articles about "machine learning" and "AI ethics" would have similar embeddings 
                  because they're related topics.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border rounded-lg px-4">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold">How does DailyDrops build my profile?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Your personalization profile is built through several steps:
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1">1</Badge>
                      <div>
                        <p className="font-medium">Onboarding</p>
                        <p className="text-sm text-muted-foreground">
                          You select topics and languages that interest you during signup
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1">2</Badge>
                      <div>
                        <p className="font-medium">Profile Vector Creation</p>
                        <p className="text-sm text-muted-foreground">
                          These preferences are converted into a unique vector stored securely in our database
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1">3</Badge>
                      <div>
                        <p className="font-medium">Continuous Refinement</p>
                        <p className="text-sm text-muted-foreground">
                          Your profile evolves as you interact with content (likes, saves, dismissals)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border rounded-lg px-4">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-semibold">How is my Daily Drop personalized?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Each article in your feed gets a personalized ranking score based on multiple factors:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Ranking Factors</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Catalog Score</span>
                          <Badge variant="outline">Quality + Authority</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Topic Match</span>
                          <Badge variant="outline">Your Interests</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Vector Similarity</span>
                          <Badge variant="outline">AI Matching</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Feedback Signals</span>
                          <Badge variant="outline">Your Actions</Badge>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Content Rules</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p>• At least 1 YouTube video per feed</p>
                        <p>• Maximum 2 articles per source</p>
                        <p>• Maximum 1 sponsored content</p>
                        <p>• Fresh content prioritized</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border rounded-lg px-4">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="font-semibold">What happens when I Like, Dismiss, or Save an item?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Every interaction you make helps improve your personalized recommendations:
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge className="bg-green-500 hover:bg-green-600 mt-1">❤️</Badge>
                      <div>
                        <p className="font-medium">Like</p>
                        <p className="text-sm text-muted-foreground">
                          Boosts similar content and sources in future feeds
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge className="bg-blue-500 hover:bg-blue-600 mt-1">📌</Badge>
                      <div>
                        <p className="font-medium">Save</p>
                        <p className="text-sm text-muted-foreground">
                          Strongest positive signal, significantly increases similar content
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1">✕</Badge>
                      <div>
                        <p className="font-medium">Dismiss</p>
                        <p className="text-sm text-muted-foreground">
                          Reduces similar content and helps avoid unwanted topics
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <strong>Pro tip:</strong> The more you interact, the better your recommendations become. 
                    Even dismissing content you don't like helps us understand your preferences better.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border rounded-lg px-4">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Does personalization change over time?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Yes! Our system adapts based on your engagement level and how long you've been using DailyDrops:
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">New</Badge>
                      <div>
                        <p className="font-medium">Cold Start (0-10 interactions)</p>
                        <p className="text-sm text-muted-foreground">
                          Relies heavily on your selected topics and popular content
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">Active</Badge>
                      <div>
                        <p className="font-medium">Active User (10+ interactions)</p>
                        <p className="text-sm text-muted-foreground">
                          Balances your preferences with feedback signals
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">Expert</Badge>
                      <div>
                        <p className="font-medium">Mature Profile (50+ interactions)</p>
                        <p className="text-sm text-muted-foreground">
                          Highly personalized based on your unique interaction patterns
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Ready for Smarter Recommendations?</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Experience the power of personalized content curation. Sign up today and let DailyDrops 
              learn your preferences to deliver the most relevant AI, tech, and business insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link to="/auth">Get Started Free</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/pricing">View Plans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Personalization;