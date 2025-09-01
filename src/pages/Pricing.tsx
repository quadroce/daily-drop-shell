import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Users, Building, Zap, Mail, Smartphone, Globe, TrendingUp } from "lucide-react";

const Pricing = () => {
  // TODO: Connect to Stripe for payment processing
  // TODO: Implement plan selection and checkout flow

  const plans = [
    {
      name: "Free",
      price: "€0",
      period: "/month",
      description: "Perfect for getting started with DailyDrops",
      icon: <Globe className="h-6 w-6" />,
      features: [
        "Daily content drops",
        "Weekly newsletter",
        "Basic personalization", 
        "Web app access",
        "Up to 3 topic preferences",
        "Community support"
      ],
      buttonText: "Current Plan",
      buttonVariant: "secondary" as const,
      popular: false,
      disabled: true
    },
    {
      name: "Premium",
      price: "€9",
      period: "/month",
      description: "Enhanced experience with WhatsApp delivery",
      icon: <Smartphone className="h-6 w-6" />,
      features: [
        "Everything in Free",
        "WhatsApp delivery 2×/day",
        "Morning (08:00) & Evening (18:00) CET",
        "Advanced personalization",
        "Content archive access",
        "Priority support",
        "No sponsored content",
        "Unlimited topic preferences"
      ],
      buttonText: "Continue",
      buttonVariant: "default" as const,
      popular: true,
      disabled: true
    },
    {
      name: "Corporate",
      price: "€49",
      period: "/month",
      description: "Official sources dashboard for organizations",
      icon: <Building className="h-6 w-6" />,
      features: [
        "Everything in Premium",
        "Official sources dashboard",
        "Submit RSS/API sources",
        "Manual content submission",
        "Analytics & insights",
        "Team management",
        "Custom branding",
        "Dedicated support"
      ],
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const,
      popular: false,
      disabled: true
    },
    {
      name: "Sponsor",
      price: "Custom",
      period: "",
      description: "Promote your content to targeted audiences",
      icon: <TrendingUp className="h-6 w-6" />,
      features: [
        "Sponsored content placement",
        "Audience targeting",
        "Performance analytics",
        "Campaign management",
        "Content optimization",
        "Dedicated account manager",
        "Priority placement options",
        "Custom reporting"
      ],
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const,
      popular: false,
      disabled: true
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Choose Your DailyDrops Experience
          </h1>
          <p className="text-xl text-muted-foreground">
            From free daily drops to premium WhatsApp delivery and enterprise solutions
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative ${
                plan.popular 
                  ? "border-primary shadow-lg scale-105 bg-primary/5" 
                  : "hover:shadow-md"
              } transition-all duration-200`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground flex items-center gap-1 px-3 py-1">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  <div className={`p-3 rounded-lg ${
                    plan.popular ? "bg-primary/20" : "bg-muted"
                  }`}>
                    {plan.icon}
                  </div>
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[3rem] flex items-center">
                  {plan.description}
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  variant={plan.buttonVariant}
                  className="w-full"
                  disabled={plan.disabled}
                >
                  {plan.buttonText}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Premium WhatsApp Info */}
        <Card className="max-w-2xl mx-auto mb-12 border-primary/20 bg-primary/5">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-primary">
              <Smartphone className="h-5 w-5" />
              Premium WhatsApp Delivery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2">Morning Drop (08:00 CET)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Fresh overnight content</li>
                  <li>• Tech & business updates</li>
                  <li>• Trending discussions</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Evening Drop (18:00 CET)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Afternoon discoveries</li>
                  <li>• In-depth articles</li>
                  <li>• Weekend reading prep</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6 text-left">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium mb-2">Can I upgrade or downgrade anytime?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes, you can change your plan anytime. Upgrades take effect immediately, 
                  downgrades at the end of your current billing cycle.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium mb-2">What happens to my WhatsApp number if I downgrade?</h3>
                <p className="text-sm text-muted-foreground">
                  Your WhatsApp number remains saved in your account. If you upgrade again, 
                  delivery will resume automatically without re-verification.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium mb-2">How does content personalization work?</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes your topic preferences, reading history, and feedback to 
                  curate content that matches your interests. Premium users get more advanced 
                  personalization algorithms.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;