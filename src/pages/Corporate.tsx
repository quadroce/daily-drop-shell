import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Shield, BarChart3, Rss, Upload, FileText, Users, CheckCircle, Plus, TrendingUp } from "lucide-react";
import { Seo } from "@/components/Seo";

const Corporate = () => {
  // TODO: Connect to corporate source management system
  // TODO: Implement RSS/API source submission
  // TODO: Connect to analytics dashboard
  // TODO: Implement team management features

  const mockSources = [
    {
      id: 1,
      name: "Company Tech Blog",
      type: "RSS Feed",
      url: "https://company.com/blog/feed.xml",
      status: "Active",
      submissions: 24,
      lastSync: "2 hours ago"
    },
    {
      id: 2,
      name: "Product Updates API",
      type: "API Integration", 
      url: "https://api.company.com/updates",
      status: "Active",
      submissions: 12,
      lastSync: "1 hour ago"
    },
    {
      id: 3,
      name: "Weekly Newsletter Archive",
      type: "Manual Upload",
      url: "Manual submission",
      status: "Pending Review",
      submissions: 3,
      lastSync: "1 day ago"
    }
  ];

  const analyticsData = [
    { metric: "Total Views", value: "12,453", change: "+18%" },
    { metric: "Engagement Rate", value: "7.2%", change: "+2.1%" },
    { metric: "Click-through Rate", value: "4.8%", change: "+0.8%" },
    { metric: "Content Shares", value: "892", change: "+24%" }
  ];

  return (
    <>
      <Seo
        title="DailyDrops Corporate - Official Source Dashboard"
        description="Corporate dashboard for organizations to manage RSS feeds, API integrations, and content submissions. Official source verification and analytics included. €49/month."
        canonical="https://dailydrops.cloud/corporate"
        ogImage="https://dailydrops.cloud/og-corporate.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "DailyDrops Corporate Dashboard",
          "description": "Official source management dashboard for organizations to distribute content through DailyDrops platform",
          "provider": {
            "@type": "Organization",
            "name": "DailyDrops"
          },
          "offers": {
            "@type": "Offer",
            "price": "49",
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock"
          },
          "serviceType": "Content Management",
          "areaServed": "Worldwide"
        }}
      />
      <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Building className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Corporate Dashboard</h1>
                <p className="text-muted-foreground">Manage your official sources and content distribution</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30">
                <Shield className="h-3 w-3 mr-1" />
                Official Source
              </Badge>
              <span className="text-sm text-muted-foreground">
                Your content appears with verified organization badge
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* Analytics Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Content Performance
              </CardTitle>
              <CardDescription>
                Track how your content performs across the DailyDrops platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                {analyticsData.map((data, index) => (
                  <div key={index} className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{data.value}</div>
                    <div className="text-sm text-muted-foreground">{data.metric}</div>
                    <div className="text-xs text-success mt-1">{data.change}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-center">
                <Button variant="outline" disabled className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  View Detailed Analytics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Source Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rss className="h-5 w-5" />
                Content Sources
              </CardTitle>
              <CardDescription>
                Manage your RSS feeds, API integrations, and manual content submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {mockSources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium">{source.name}</h3>
                        <Badge variant={source.status === "Active" ? "default" : "secondary"}>
                          {source.status}
                        </Badge>
                        <Badge variant="outline">{source.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{source.url}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{source.submissions} submissions</span>
                        <span>Last sync: {source.lastSync}</span>
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
                ))}
              </div>
              
              <Button disabled className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Source
              </Button>
            </CardContent>
          </Card>

          {/* Add New Source Form */}
          <Card>
            <CardHeader>
              <CardTitle>Submit New Content Source</CardTitle>
              <CardDescription>
                Add RSS feeds, API endpoints, or manually submit content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* RSS Feed */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Rss className="h-4 w-4 text-primary" />
                      RSS Feed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rss-url">Feed URL</Label>
                      <Input
                        id="rss-url"
                        placeholder="https://company.com/feed.xml"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rss-name">Source Name</Label>
                      <Input
                        id="rss-name"
                        placeholder="Company Blog"
                        disabled
                      />
                    </div>
                    <Button className="w-full" disabled>
                      <Rss className="h-4 w-4 mr-2" />
                      Submit RSS Feed
                    </Button>
                  </CardContent>
                </Card>

                {/* API Integration */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      API Integration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api-endpoint">API Endpoint</Label>
                      <Input
                        id="api-endpoint"
                        placeholder="https://api.company.com/content"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api-auth">Authentication</Label>
                      <Select disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Select auth method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="api-key">API Key</SelectItem>
                          <SelectItem value="oauth">OAuth</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" disabled>
                      <Upload className="h-4 w-4 mr-2" />
                      Submit API Source
                    </Button>
                  </CardContent>
                </Card>

                {/* Manual Submission */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Manual Upload
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="content-title">Content Title</Label>
                      <Input
                        id="content-title"
                        placeholder="Article or update title"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content-url">Content URL</Label>
                      <Input
                        id="content-url"
                        placeholder="https://company.com/article"
                        disabled
                      />
                    </div>
                    <Button className="w-full" disabled>
                      <FileText className="h-4 w-4 mr-2" />
                      Submit Manual Content
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Team Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Management
              </CardTitle>
              <CardDescription>
                Manage team members who can submit and manage corporate content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">john.doe@company.com</p>
                    <p className="text-sm text-muted-foreground">Admin • Content Manager</p>
                  </div>
                  <Badge>Owner</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">sarah.smith@company.com</p>
                    <p className="text-sm text-muted-foreground">Editor • Content Reviewer</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Editor</Badge>
                    <Button variant="outline" size="sm" disabled>
                      Manage
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <Button disabled className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Invite Team Member
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Official Source Badge Preview */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Official Source Badge</CardTitle>
              <CardDescription>
                This is how your content appears to DailyDrops users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-card border rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-2">
                      Revolutionary AI Framework Launched by TechCorp
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🏢</span>
                      <span className="text-sm text-muted-foreground">TechCorp Official</span>
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        <Shield className="w-3 h-3 mr-1" />
                        Official Source
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">AI</Badge>
                      <Badge variant="secondary" className="text-xs">Technology</Badge>
                      <Badge variant="secondary" className="text-xs">Innovation</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
};

export default Corporate;