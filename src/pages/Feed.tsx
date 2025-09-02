import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Bookmark, X, ThumbsDown, ExternalLink, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";

const Feed = () => {
  const { fallbackPrefs, isFallbackActive } = usePreferences();
  const [drops, setDrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchCandidateDrops = async () => {
      try {
        const { data, error } = await supabase.rpc('get_candidate_drops', { limit_n: 10 });
        
        if (error || !data || data.length === 0) {
          console.error('Error fetching candidate drops:', error);
          
          // Check if fallback is active and use mock data
          if (isFallbackActive && fallbackPrefs) {
            console.debug('[Feed] Using fallback mode with mock data');
            setDrops(mockDrops.slice(0, 5)); // Use first 5 mock drops
            setLoading(false);
            return;
          }
          
          setDrops([]);
          setLoading(false);
          return;
        }

        if (data) {
          // Fetch source names for each drop
          const dropsWithSources = await Promise.all(
            data.map(async (drop) => {
              if (drop.source_id) {
                const { data: source } = await supabase
                  .from('sources')
                  .select('name')
                  .eq('id', drop.source_id)
                  .single();
                
                return {
                  ...drop,
                  source: source?.name || 'Unknown Source',
                  favicon: drop.type === 'video' ? '📺' : '📄'
                };
              }
              return {
                ...drop,
                source: 'Unknown Source',
                favicon: drop.type === 'video' ? '📺' : '📄'
              };
            })
          );

          setDrops(dropsWithSources);
        }
      } catch (error) {
        console.error('Error fetching drops:', error);
        
        // Fallback to mock data if there's an error and fallback is active
        if (isFallbackActive && fallbackPrefs) {
          console.debug('[Feed] Exception caught, using fallback mode');
          setDrops(mockDrops.slice(0, 5));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateDrops();
  }, [isFallbackActive, fallbackPrefs]);

  const handleSave = async (dropId: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to save content.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('bookmarks')
        .insert({ user_id: user.id, drop_id: dropId })
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Saved to your profile",
        description: "Content has been added to your saved items.",
      });
    } catch (error) {
      console.error('Error saving bookmark:', error);
      toast({
        title: "Couldn't save content",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEngagement = async (dropId: number, action: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.debug('User not logged in, skipping engagement tracking');
        return;
      }

      const { error } = await supabase
        .from('engagement_events')
        .insert({
          user_id: user.id,
          drop_id: dropId,
          action,
          channel: 'web'
        });

      if (error) {
        throw error;
      }
      
      console.debug(`[Engagement] ${action} recorded for drop ${dropId}`);
    } catch (error) {
      console.error('Error recording engagement:', error);
    }
  };


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
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={() => handleEngagement(drop.id, 'open')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {drop.tags?.slice(0, 3).map((tag: string) => (
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
              onClick={() => handleSave(drop.id)}
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" 
              onClick={() => handleEngagement(drop.id, 'dismiss')}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary" 
              onClick={() => handleEngagement(drop.id, 'like')}
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-muted" 
              onClick={() => handleEngagement(drop.id, 'dislike')}
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Your Daily Drop is being prepared.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Today's Drops</h1>
        <p className="text-muted-foreground">Curated content based on your interests</p>
        
        {/* Constraint helper */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            ≥1 YouTube per Drop • ≤2 per source • ≤1 sponsored
            {isFallbackActive && (
              <span className="ml-2 px-2 py-1 bg-warning/20 text-warning text-xs rounded">
                Using temporary preferences
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {drops.length > 0 ? (
          <>
            {drops.map((drop) => (
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
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Your Daily Drop is being prepared.</div>
            <p className="text-sm text-muted-foreground mt-2">
              {isFallbackActive 
                ? "Using temporary preferences for this session"
                : "Set your preferences to get personalized content"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;