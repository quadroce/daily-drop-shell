import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Bookmark, X, ThumbsDown, ExternalLink, Star } from "lucide-react";

const Feed = () => {
  // TODO: Connect to backend for personalized content ranking
  // TODO: Implement save/dismiss/like/dislike actions
  
  const mockDrops = [
    {
      id: 1,
      title: "The Future of AI in Content Discovery",
      source: "TechCrunch",
      favicon: "🔥",
      tags: ["AI", "Technology", "Content"],
      type: "article",
      url: "#"
    },
    {
      id: 2,
      title: "Building Scalable React Applications",
      source: "YouTube - Vercel",
      favicon: "📺",
      tags: ["React", "JavaScript", "Development"],
      type: "video",
      url: "#"
    },
    {
      id: 3,
      title: "The Psychology of Daily Habits",
      source: "Medium",
      favicon: "📖",
      tags: ["Psychology", "Productivity", "Habits"],
      type: "article",
      url: "#"
    },
    {
      id: 4,
      title: "Climate Tech Innovations in 2024",
      source: "Nature",
      favicon: "🌱",
      tags: ["Climate", "Technology", "Innovation"],
      type: "research",
      url: "#"
    },
    {
      id: 5,
      title: "Advanced TypeScript Patterns",
      source: "YouTube - Matt Pocock",
      favicon: "📺",
      tags: ["TypeScript", "Programming", "Tutorial"],
      type: "video",
      url: "#"
    }
  ];

  const sponsoredContent = {
    id: "sponsored-1",
    title: "Unlock Premium Development Tools",
    source: "DevTools Pro",
    favicon: "⚡",
    tags: ["Sponsored", "Tools", "Development"],
    type: "sponsored",
    url: "#"
  };

  const DropCard = ({ drop, isSponsored = false }: { drop: any; isSponsored?: boolean }) => (
    <Card className={`group hover:bg-card-hover transition-all duration-200 ${isSponsored ? 'border-warning/40 bg-warning/5' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
              {drop.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg">{drop.favicon}</span>
              <span className="text-sm text-muted-foreground truncate">{drop.source}</span>
              {isSponsored && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  <Star className="w-3 h-3 mr-1" />
                  Sponsored
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {drop.tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-success/10 hover:text-success" 
              disabled
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" 
              disabled
            >
              <X className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary" 
              disabled
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-muted" 
              disabled
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Today's Drops</h1>
        <p className="text-muted-foreground">Curated content based on your interests</p>
        
        {/* Constraint helper */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            ≥1 YouTube per Drop • ≤2 per source • ≤1 sponsored
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {mockDrops.map((drop) => (
          <DropCard key={drop.id} drop={drop} />
        ))}
        
        {/* Sponsored content */}
        <DropCard drop={sponsoredContent} isSponsored />
        
        {/* End of feed message */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
            <span className="text-sm text-muted-foreground">That's it for today.</span>
            <span className="text-lg">✨</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Check back tomorrow for fresh content
          </p>
        </div>
      </div>
    </div>
  );
};

export default Feed;