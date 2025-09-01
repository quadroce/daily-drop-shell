import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Target, BarChart3, DollarSign, Calendar, Users, Star, CheckCircle, Plus, Eye } from "lucide-react";

const Sponsor = () => {
  const [budget, setBudget] = useState([500]);
  const [duration, setDuration] = useState([7]);

  // TODO: Connect to sponsored content management system
  // TODO: Implement campaign creation and targeting
  // TODO: Connect to payment processing for sponsored content
  // TODO: Implement analytics dashboard for sponsors

  const mockCampaigns = [
    {
      id: 1,
      title: "AI Development Tools Launch",
      status: "Active",
      budget: "$1,200",
      spent: "$340",
      impressions: "24,750",
      clicks: "892", 
      duration: "14 days remaining"
    },
    {
      id: 2,
      title: "Cloud Infrastructure Guide",
      status: "Completed",
      budget: "$800",
      spent: "$800",
      impressions: "18,500",
      clicks: "1,240",
      duration: "Ended 3 days ago"
    },
    {
      id: 3,
      title: "SaaS Marketing Webinar",
      status: "Pending",
      budget: "$600",
      spent: "$0",
      impressions: "0",
      clicks: "0",
      duration: "Starts in 2 days"
    }
  ];

  const targetingOptions = [
    { value: "technology", label: "Technology & Programming" },
    { value: "business", label: "Business & Entrepreneurship" },
    { value: "design", label: "Design & Creativity" },
    { value: "marketing", label: "Marketing & Growth" },
    { value: "finance", label: "Finance & Investment" },
    { value: "ai", label: "Artificial Intelligence" },
    { value: "startup", label: "Startups & Innovation" },
    { value: "productivity", label: "Productivity & Tools" }
  ];

  const performanceMetrics = [
    { label: "Total Impressions", value: "43,250", change: "+12%" },
    { label: "Click-through Rate", value: "4.2%", change: "+0.8%" },
    { label: "Engagement Rate", value: "8.7%", change: "+2.1%" },
    { label: "Cost per Click", value: "$0.42", change: "-$0.08" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Sponsor Dashboard</h1>
                <p className="text-muted-foreground">Promote your content to targeted DailyDrops audiences</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className="bg-warning/20 text-warning border-warning/30">
                <Star className="h-3 w-3 mr-1" />
                Sponsored
              </Badge>
              <span className="text-sm text-muted-foreground">
                Your content appears with sponsored label for transparency
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* Performance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Campaign Performance
              </CardTitle>
              <CardDescription>
                Track the performance of your sponsored content campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                {performanceMetrics.map((metric, index) => (
                  <div key={index} className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                    <div className="text-sm text-muted-foreground">{metric.label}</div>
                    <div className="text-xs text-success mt-1">{metric.change}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-center">
                <Button variant="outline" disabled className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View Detailed Analytics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
              <CardDescription>
                Manage and monitor your sponsored content campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {mockCampaigns.map((campaign) => (
                  <div key={campaign.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-foreground">{campaign.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={
                              campaign.status === "Active" ? "default" :
                              campaign.status === "Completed" ? "secondary" : "outline"
                            }
                          >
                            {campaign.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{campaign.duration}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" disabled>
                          Analytics
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Budget:</span>
                        <div className="font-medium">{campaign.budget}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Spent:</span>
                        <div className="font-medium">{campaign.spent}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Impressions:</span>
                        <div className="font-medium">{campaign.impressions}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clicks:</span>
                        <div className="font-medium">{campaign.clicks}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button disabled className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New Campaign
              </Button>
            </CardContent>
          </Card>

          {/* Create Campaign Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Campaign</CardTitle>
              <CardDescription>
                Set up a new sponsored content campaign to reach your target audience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Content Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Content Details</h4>
                  <div className="space-y-2">
                    <Label htmlFor="article-url">Article/Content URL</Label>
                    <Input
                      id="article-url"
                      placeholder="https://yoursite.com/article"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be a live URL to your content
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="campaign-title">Campaign Title</Label>
                    <Input
                      id="campaign-title"
                      placeholder="AI Development Tools Launch"
                      disabled
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="campaign-description">Description</Label>
                    <Textarea
                      id="campaign-description"
                      placeholder="Brief description of your content..."
                      rows={3}
                      disabled
                    />
                  </div>
                </div>

                {/* Targeting */}
                <div className="space-y-4">
                  <h4 className="font-medium">Audience Targeting</h4>
                  <div className="space-y-2">
                    <Label htmlFor="target-topics">Target Topics</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target topics" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetingOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose topics that align with your content
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="target-languages">Target Languages</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Select languages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="target-plan">User Plan Type</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="free">Free Users Only</SelectItem>
                        <SelectItem value="premium">Premium Users Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Budget & Duration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Campaign Budget</h4>
                  <div className="space-y-2">
                    <Label>Total Budget: ${budget[0]}</Label>
                    <Slider
                      value={budget}
                      onValueChange={setBudget}
                      max={5000}
                      min={100}
                      step={50}
                      disabled
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>$100</span>
                      <span>$5,000</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Estimated Impressions:</span>
                        <span className="font-medium">{(budget[0] * 50).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Clicks:</span>
                        <span className="font-medium">{Math.round(budget[0] * 2.1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost per Click:</span>
                        <span className="font-medium">~$0.40</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Campaign Duration</h4>
                  <div className="space-y-2">
                    <Label>Duration: {duration[0]} days</Label>
                    <Slider
                      value={duration}
                      onValueChange={setDuration}
                      max={30}
                      min={1}
                      step={1}
                      disabled
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 day</span>
                      <span>30 days</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      disabled
                    />
                  </div>
                  
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="text-sm">
                      <p className="font-medium text-primary mb-1">Daily Budget</p>
                      <p className="text-primary/80">
                        ${Math.round(budget[0] / duration[0])} per day
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled>
                  Save as Draft
                </Button>
                <Button disabled>
                  Launch Campaign
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sponsored Content Preview */}
          <Card className="border-warning/20 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">Sponsored Content Preview</CardTitle>
              <CardDescription>
                This is how your sponsored content appears to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-card border rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-2">
                      Revolutionary AI Development Tools - Free Trial Available
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">⚡</span>
                      <span className="text-sm text-muted-foreground">DevTools Pro</span>
                      <Badge className="bg-warning/20 text-warning border-warning/30">
                        <Star className="w-3 h-3 mr-1" />
                        Sponsored
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="secondary" className="text-xs">AI</Badge>
                      <Badge variant="secondary" className="text-xs">Development</Badge>
                      <Badge variant="secondary" className="text-xs">Tools</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Discover next-generation AI-powered development tools that streamline your workflow...
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Sponsor;