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
import { fetchAvailableLanguages } from '@/lib/api/profile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [availableLanguages, setAvailableLanguages] = useState<{ code: string; label: string }[]>([]);

  useEffect(() => {
    loadLanguages();
  }, []);

  useEffect(() => {
    if (!slug) return;
    
    loadPartner();
    trackPartnerEvent(slug, 'view');
  }, [slug]);

  useEffect(() => {
    if (partnerData) {
      // Reset feed when language changes
      setFeedItems([]);
      setCursor(null);
      setHasMore(true);
      loadFeed(true);
    }
  }, [partnerData, selectedLanguage]);

  async function loadLanguages() {
    try {
      const languages = await fetchAvailableLanguages();
      setAvailableLanguages(languages);
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  }

  async function loadPartner() {
    if (!slug) return;
    
    try {
      const data = await getPartnerBySlug(slug);
      
      if (!data) {
        navigate('/404');
        return;
      }
      
      setPartnerData(data);
      
      // Use is_following from backend response
      setIsFollowing(data.is_following || false);
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

  async function loadFeed(reset = false) {
    if (!slug || feedLoading || (!hasMore && !reset)) return;
    
    try {
      setFeedLoading(true);
      const currentCursor = reset ? null : cursor;
      const languageCode = selectedLanguage === 'all' ? undefined : selectedLanguage;
      const response = await getPartnerFeed(slug, currentCursor, 20, languageCode);
      
      const newItems = response.items || [];
      setFeedItems(prev => reset ? newItems : [...prev, ...newItems]);
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
      // Save partner topics to localStorage for unauthenticated users
      if (partnerData?.topics && partnerData.topics.length > 0) {
        try {
          const savedTopics = JSON.parse(localStorage.getItem('dailydrops_saved_topics') || '[]');
          const topicIds = partnerData.topics.map(t => t.id);
          const updatedTopics = Array.from(new Set([...savedTopics, ...topicIds]));
          localStorage.setItem('dailydrops_saved_topics', JSON.stringify(updatedTopics));
          
          toast({
            title: 'Topics saved',
            description: 'Sign up to complete following this partner!',
          });
        } catch (error) {
          console.error('Error saving topics:', error);
        }
      }
      
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

      {/* Banner - Hero Section (reduced height) */}
      {(partner.youtube_url || partner.banner_url) && (
        <div className="w-full">
          {partner.youtube_url ? (
            <div className="h-48 w-full overflow-hidden">
              <iframe
                src={partner.youtube_url.replace('watch?v=', 'embed/')}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : partner.banner_url ? (
            <div className="h-48 w-full overflow-hidden">
              <img 
                src={partner.banner_url} 
                alt={partner.name}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Company Info Section */}
      <div className="w-full bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Logo and Name */}
          <div className="flex items-start gap-4 mb-4">
            {partner.logo_url && (
              <img 
                src={partner.logo_url} 
                alt={`${partner.name} logo`}
                className="h-20 w-20 object-contain rounded-lg border"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{partner.title || partner.name}</h1>
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

          {/* Description */}
          {partner.description_md && (
            <div className="mb-6">
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{partner.description_md}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Link Buttons (Red) */}
            {links.map(link => (
              <Button
                key={link.position}
                size="lg"
                className="gap-2 bg-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,55%)] text-white"
                onClick={() => {
                  const url = link.utm ? `${link.url}${link.url.includes('?') ? '&' : '?'}${link.utm}` : link.url;
                  handleLinkClick(link.position, url);
                }}
              >
                {link.label}
                <ExternalLink className="h-4 w-4" />
              </Button>
            ))}
            
            {/* Follow Button (Blue) */}
            <Button 
              onClick={handleFollow}
              disabled={following || isFollowing}
              size="lg"
              className="gap-2"
              variant="default"
            >
              <Heart className={`h-4 w-4 ${isFollowing ? 'fill-current' : ''}`} />
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        </div>
      </div>

      {/* Feed - Same as /feed */}
      <div className="container mx-auto px-4 pb-12">
        {/* Language Filter */}
        <div className="mb-6 flex items-center gap-3">
          <label htmlFor="language-select" className="text-sm font-medium">
            Filter by language:
          </label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger id="language-select" className="w-[200px]">
              <SelectValue placeholder="All languages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {availableLanguages.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
