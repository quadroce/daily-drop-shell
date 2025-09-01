import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bookmark, Heart, History, ExternalLink, Calendar, Eye } from "lucide-react";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("saved");

  // TODO: Connect to user's saved/liked/history data from Supabase
  
  const mockSavedItems = [
    {
      id: 1,
      title: "The Future of AI in Content Discovery",
      source: "TechCrunch",
      savedAt: "2024-01-15",
      tags: ["AI", "Technology"]
    },
    {
      id: 2,
      title: "Building Scalable React Applications",
      source: "YouTube - Vercel", 
      savedAt: "2024-01-14",
      tags: ["React", "Development"]
    },
    {
      id: 3,
      title: "Climate Tech Innovations in 2024",
      source: "Nature",
      savedAt: "2024-01-13",
      tags: ["Climate", "Innovation"]
    }
  ];

  const mockLikedItems = [
    {
      id: 1,
      title: "Advanced TypeScript Patterns",
      source: "YouTube - Matt Pocock",
      likedAt: "2024-01-15",
      tags: ["TypeScript", "Programming"]
    },
    {
      id: 2,
      title: "The Psychology of Daily Habits",
      source: "Medium",
      likedAt: "2024-01-14",
      tags: ["Psychology", "Habits"]
    }
  ];

  const mockHistory = [
    {
      id: 1,
      action: "Viewed",
      title: "The Future of AI in Content Discovery",
      source: "TechCrunch",
      timestamp: "2024-01-15 09:30"
    },
    {
      id: 2,
      action: "Liked",
      title: "Advanced TypeScript Patterns",
      source: "YouTube - Matt Pocock",
      timestamp: "2024-01-15 09:15"
    },
    {
      id: 3,
      action: "Saved",
      title: "Building Scalable React Applications",
      source: "YouTube - Vercel",
      timestamp: "2024-01-14 16:45"
    },
    {
      id: 4,
      action: "Dismissed",
      title: "Random Article Title",
      source: "Some Blog",
      timestamp: "2024-01-14 14:20"
    },
    {
      id: 5,
      action: "Viewed",
      title: "Climate Tech Innovations in 2024",
      source: "Nature",
      timestamp: "2024-01-13 11:00"
    }
  ];

  const ContentGrid = ({ items, emptyMessage }: { items: any[]; emptyMessage: string }) => (
    <div className="space-y-4">
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="group hover:bg-card-hover transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{item.source}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {item.savedAt && `Saved ${item.savedAt}`}
                      {item.likedAt && `Liked ${item.likedAt}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground space-y-2">
              <p>{emptyMessage}</p>
              <p className="text-sm">Start exploring content to build your collection</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const HistoryTable = ({ items }: { items: any[] }) => (
    <div className="space-y-4">
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="group hover:bg-card-hover transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.action === "Viewed" && <Eye className="h-4 w-4 text-primary" />}
                      {item.action === "Liked" && <Heart className="h-4 w-4 text-destructive" />}
                      {item.action === "Saved" && <Bookmark className="h-4 w-4 text-success" />}
                      {item.action === "Dismissed" && <div className="h-4 w-4 rounded-full bg-muted" />}
                      <span className="text-sm font-medium">{item.action}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.source}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground space-y-2">
              <p>No activity history yet</p>
              <p className="text-sm">Your content interactions will appear here</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">JD</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-foreground">John Doe</h1>
            <p className="text-muted-foreground">john@example.com</p>
            <p className="text-sm text-muted-foreground">Member since January 2024</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{mockSavedItems.length}</div>
              <div className="text-sm text-muted-foreground">Saved Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{mockLikedItems.length}</div>
              <div className="text-sm text-muted-foreground">Liked Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-success">{mockHistory.length}</div>
              <div className="text-sm text-muted-foreground">Total Actions</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            Saved
          </TabsTrigger>
          <TabsTrigger value="liked" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Liked
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saved" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Saved Content</CardTitle>
              <CardDescription>
                Articles, videos, and other content you've saved for later
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentGrid 
                items={mockSavedItems} 
                emptyMessage="No saved content yet" 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liked" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Liked Content</CardTitle>
              <CardDescription>
                Content you've liked to help improve recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentGrid 
                items={mockLikedItems} 
                emptyMessage="No liked content yet" 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>
                Your recent interactions with DailyDrops content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HistoryTable items={mockHistory} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;