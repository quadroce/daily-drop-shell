import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Seo } from '@/components/Seo';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, Heart } from 'lucide-react';
import { 
  getPartnerBySlug, 
  getPartnerFeed, 
  followPartner, 
  trackPartnerEvent,
  type PartnerData 
} from '@/lib/api/partners';
import { SimpleFeedList } from '@/components/SimpleFeedList';
import { supabase } from '@/integrations/supabase/client';

export default function Partner() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [following, setFollowing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    
    loadPartner();
    trackPartnerEvent(slug, 'view');
  }, [slug]);

  useEffect(() => {
    if (partnerData) {
      loadFeed();
    }
  }, [partnerData]);

  async function loadPartner() {
    if (!slug) return;
    
    try {
      const data = await getPartnerBySlug(slug);
      
      if (!data) {
        navigate('/404');
        return;
      }
      
      setPartnerData(data);
      
      // Check if user is following
      if (user && data.topics.length > 0) {
        const { data: prefs } = await supabase
          .from('preferences')
          .select('selected_topic_ids')
          .eq('user_id', user.id)
          .single();
        
        if (prefs?.selected_topic_ids) {
          const topicIds = data.topics.map(t => t.id);
          const isFollowingAll = topicIds.every(id => prefs.selected_topic_ids.includes(id));
          setIsFollowing(isFollowingAll);
        }
      }
    } catch (error) {
      console.error('Error loading partner:', error);
      toast({
        title: 'Error',
        description: 'Failed to load partner page',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadFeed() {
    if (!slug || feedLoading || !hasMore) return;
    
    try {
      setFeedLoading(true);
      const response = await getPartnerFeed(slug, cursor);
      
      const newItems = response.items || [];
      setFeedItems(prev => [...prev, ...newItems]);
      setCursor(response.nextCursor);
      setHasMore(!!response.nextCursor);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setFeedLoading(false);
    }
  }

  async function handleFollow() {
    if (!user) {
      navigate(`/auth?next=/${slug}&follow=1`);
      return;
    }
    
    if (following) return;
    
    try {
      setFollowing(true);
      await followPartner(slug!);
      setIsFollowing(true);
      toast({
        title: 'Success',
        description: `You're now following ${partnerData?.partner.name}`,
      });
    } catch (error) {
      console.error('Error following partner:', error);
      toast({
        title: 'Error',
        description: 'Failed to follow partner',
        variant: 'destructive',
      });
    } finally {
      setFollowing(false);
    }
  }

  function handleLinkClick(position: number, url: string) {
    trackPartnerEvent(slug!, 'link_click', { position });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="w-full h-[400px] mb-8" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-8" />
      </div>
    );
  }

  if (!partnerData) {
    return null;
  }

  const { partner, links, topics } = partnerData;

  return (
    <>
      <Seo
        title={`${partner.title || partner.name} | DailyDrops`}
        description={partner.description_md?.substring(0, 160) || `Latest updates from ${partner.name}`}
        ogImage={partner.banner_url || partner.logo_url}
      />

      {/* Header Section - Above Hero */}
      <div className="w-full bg-gradient-to-b from-background/50 to-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              {partner.logo_url && (
                <img 
                  src={partner.logo_url} 
                  alt={`${partner.name} logo`}
                  className="h-16 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-4xl font-bold mb-2">{partner.title || partner.name}</h1>
                {topics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {topics.map(topic => (
                      <span 
                        key={topic.id}
                        className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full"
                      >
                        {topic.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              onClick={handleFollow}
              disabled={following || isFollowing}
              size="lg"
              className="gap-2"
            >
              <Heart className={`h-4 w-4 ${isFollowing ? 'fill-current' : ''}`} />
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>

          {/* Description */}
          {partner.description_md && (
            <Card className="p-6 mb-6">
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{partner.description_md}</ReactMarkdown>
              </div>
            </Card>
          )}

          {/* Links - Red buttons with white text */}
          {links.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {links.map(link => (
                <Button
                  key={link.position}
                  size="lg"
                  className="gap-2 justify-center bg-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,55%)] text-white"
                  onClick={() => {
                    const url = link.utm ? `${link.url}${link.url.includes('?') ? '&' : '?'}${link.utm}` : link.url;
                    handleLinkClick(link.position, url);
                  }}
                >
                  {link.label}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Banner or YouTube - Hero Section */}
      {(partner.youtube_url || partner.banner_url) && (
        <div className="w-full">
          <div className="container mx-auto px-4">
            {partner.youtube_url ? (
              <div className="aspect-video w-full mb-8 rounded-lg overflow-hidden">
                <iframe
                  src={partner.youtube_url.replace('watch?v=', 'embed/')}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : partner.banner_url ? (
              <div className="aspect-video w-full mb-8 rounded-lg overflow-hidden">
                <img 
                  src={partner.banner_url} 
                  alt={partner.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Feed - Same as /feed */}
      <div className="container mx-auto px-4 pb-12">
        <SimpleFeedList
          items={feedItems}
          load={loadFeed}
          hasMore={hasMore}
          loading={feedLoading}
          error={null}
          onRetry={() => {}}
        />

        {!feedLoading && feedItems.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No content available yet</p>
          </Card>
        )}
      </div>
    </>
  );
}
