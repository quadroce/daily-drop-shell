import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, User, Image, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeThumbnailFromUrl } from "@/lib/youtube";

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicProfile = async () => {
      if (!username) return;
      
      try {
        // Find user by display_name (username)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, created_at')
          .eq('display_name', username)
          .limit(1);

        if (!profiles || profiles.length === 0) {
          setLoading(false);
          return;
        }

        const userProfile = profiles[0];
        setProfile(userProfile);

        // Fetch user's saved bookmarks with drop details
        const { data: bookmarks } = await supabase
          .from('bookmarks')
          .select(`
            created_at,
            drops (
              id,
              title,
              tags,
              url,
              type,
              sources (name)
            )
          `)
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (bookmarks) {
          setSavedItems(bookmarks.map(bookmark => ({
            id: bookmark.drops?.id,
            title: bookmark.drops?.title,
            source: bookmark.drops?.sources?.name || 'Unknown',
            tags: bookmark.drops?.tags || [],
            image_url: null, // Will be populated from mock or fallback
            summary: null, // Will be populated from mock or fallback
            url: bookmark.drops?.url,
            type: bookmark.drops?.type,
            savedAt: new Date(bookmark.created_at).toLocaleDateString()
          })));
        }
      } catch (error) {
        console.error('Error fetching public profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground space-y-2">
              <p>User not found</p>
              <p className="text-sm">The user @{username} doesn't exist or their profile is private</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getImageUrl = (item: any) => {
    if (item.type === 'video' && item.url) {
      const thumbnailUrl = getYouTubeThumbnailFromUrl(item.url);
      if (thumbnailUrl) return thumbnailUrl;
    }
    return item.image_url;
  };

  const ContentGrid = ({ items }: { items: any[] }) => (
    <div className="space-y-4">
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const imageUrl = getImageUrl(item);
            
            return (
              <Card key={item.id} className="group hover:bg-card-hover transition-colors">
                <div className="flex">
                  {/* Image */}
                  <div className="relative w-24 h-20 overflow-hidden rounded-l-lg shrink-0">
                    {imageUrl ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={imageUrl} 
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        {item.type === 'video' && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <Play className="h-4 w-4 text-white fill-white" />
                          </div>
                        )}
                      </div>
                    ) : null}
                    <div className={`${imageUrl ? 'hidden' : 'flex'} w-full h-full bg-muted items-center justify-center`}>
                      <Image className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <CardContent className="p-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors">
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {item.title}
                          </a>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{item.source}</p>
                        {item.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.summary}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags?.slice(0, 2).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Saved {item.savedAt}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="shrink-0 h-8 w-8"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground space-y-2">
              <p>No saved content yet</p>
              <p className="text-sm">{profile.display_name} hasn't saved any content publicly</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">
              {profile.display_name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-foreground">@{profile.display_name}</h1>
            <p className="text-sm text-muted-foreground">
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{savedItems.length}</div>
              <div className="text-sm text-muted-foreground">Public Saves</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">—</div>
              <div className="text-sm text-muted-foreground">Profile Views</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Saved Content</CardTitle>
          <CardDescription>
            Content that @{profile.display_name} has publicly saved
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContentGrid items={savedItems} />
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicProfile;