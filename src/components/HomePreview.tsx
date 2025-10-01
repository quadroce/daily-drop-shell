import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getYouTubeThumbnailFromUrl, getYouTubeFallbackThumbnail } from "@/lib/youtube";
import { CTABannerCard } from "./CTABannerCard";
import { PreviewModal } from "./PreviewModal";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Drop = {
  id: number;
  title: string;
  summary: string | null;
  image_url: string | null;
  url: string;
  type: string;
  source_name: string | null;
  published_at: string;
};

export const HomePreview = () => {
  const { user } = useAuth();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrops = async () => {
      try {
        const { data, error } = await supabase
          .from('drops')
          .select(`
            id, title, summary, image_url, url, type, published_at,
            sources:source_id(name)
          `)
          .eq('tag_done', true)
          .order('published_at', { ascending: false })
          .limit(18);

        if (error) throw error;

        const formattedDrops = data?.map((drop: any) => ({
          id: drop.id,
          title: drop.title,
          summary: drop.summary,
          image_url: drop.image_url,
          url: drop.url,
          type: drop.type,
          source_name: drop.sources?.name || 'Unknown Source',
          published_at: drop.published_at,
        })) || [];

        setDrops(formattedDrops);
      } catch (error) {
        console.error('Error fetching drops:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDrops();
  }, []);

  const handleCardClick = (drop: Drop) => {
    if (!user) {
      setSelectedDrop(drop);
    } else {
      window.open(drop.url, '_blank');
    }
  };

  const DropImage = ({ drop }: { drop: Drop }) => {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
      if (drop.image_url) {
        setImageSrc(drop.image_url);
      } else if (drop.type === 'video') {
        const thumbnail = getYouTubeThumbnailFromUrl(drop.url);
        if (thumbnail) {
          setImageSrc(thumbnail);
        }
      }
    }, [drop]);

    const handleImageError = () => {
      if (!imageError && drop.type === 'video') {
        const fallbackThumbnail = getYouTubeFallbackThumbnail(drop.url);
        if (fallbackThumbnail) {
          setImageSrc(fallbackThumbnail);
          setImageError(true);
        }
      }
    };

    if (!imageSrc) {
      return <div className="aspect-video bg-muted rounded-t-2xl" />;
    }

    return (
      <div className="aspect-video bg-muted rounded-t-2xl overflow-hidden">
        <img 
          src={imageSrc}
          alt={drop.title}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      </div>
    );
  };

  const renderGridItems = () => {
    const items: JSX.Element[] = [];
    
    drops.forEach((drop, index) => {
      // Add CTA banner every 6 items (after positions 5, 11, 17...)
      if (index > 0 && index % 6 === 0) {
        items.push(<CTABannerCard key={`cta-${index}`} />);
      }

      items.push(
        <Card 
          key={drop.id}
          className="rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 bg-card cursor-pointer"
          onClick={() => handleCardClick(drop)}
        >
          <CardContent className="p-0">
            <DropImage drop={drop} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs rounded-full">
                  {drop.type === 'video' ? '📹' : '📄'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {drop.source_name}
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug">
                {drop.title}
              </h3>
              {drop.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {drop.summary}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {new Date(drop.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });

    return items;
  };

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
            Latest Drops
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="rounded-2xl">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted rounded-t-2xl animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
            Latest Drops
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {renderGridItems()}
          </div>

          <div className="text-center">
            <Link 
              to="/feed"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-lg"
            >
              See more on the Feed
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <PreviewModal 
        drop={selectedDrop}
        open={!!selectedDrop}
        onClose={() => setSelectedDrop(null)}
      />
    </>
  );
};
