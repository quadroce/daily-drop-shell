import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Heart, HeartOff, Rss, Share2, UserPlus, ExternalLink, Copy, MessageCircle } from "lucide-react";
import { FollowTopicButton } from "@/components/FollowTopicButton";
import { RssButton } from "@/components/RssButton";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { addUtmToUrl } from "@/lib/utils/utm";
import { Link, useLocation } from "react-router-dom";

interface TopicCtaBarProps {
  topicId: number;
  topicSlug: string;
  topicTitle: string;
  pageTitle: string;
  pageUrl: string;
  sticky?: boolean;
  className?: string;
}

export const TopicCtaBar = ({ 
  topicId, 
  topicSlug, 
  topicTitle, 
  pageTitle, 
  pageUrl,
  sticky = false,
  className = ""
}: TopicCtaBarProps) => {
  const { session } = useAuth();
  const { track } = useAnalytics();
  const { toast } = useToast();
  const location = useLocation();
  const [shareOpen, setShareOpen] = useState(false);

  const shareText = `AI moves fast 🚀 Today's curated Drop on ${topicTitle}: ${pageTitle} 👉`;
  
  const handleShare = (channel: 'linkedin' | 'reddit' | 'whatsapp' | 'copy') => {
    const urlWithUtm = addUtmToUrl(pageUrl, 'share', channel, 'topic');
    
    track('share_topic_clicked', { 
      channel,
      topic_slug: topicSlug,
      topic_id: topicId,
      location: 'cta_bar'
    });

    switch (channel) {
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${shareText} ${urlWithUtm}`)}`,
          '_blank',
          'noopener,noreferrer'
        );
        break;
      case 'reddit':
        window.open(
          `https://www.reddit.com/submit?url=${encodeURIComponent(urlWithUtm)}&title=${encodeURIComponent(pageTitle)}`,
          '_blank',
          'noopener,noreferrer'
        );
        break;
      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText} ${urlWithUtm}`)}`,
          '_blank',
          'noopener,noreferrer'
        );
        break;
      case 'copy':
        navigator.clipboard.writeText(`${shareText} ${urlWithUtm}`).then(() => {
          toast({
            title: "Link copied!",
            description: "Share message copied to clipboard",
          });
        });
        break;
    }
    setShareOpen(false);
  };

  const handleSignupClick = () => {
    track('signup_from_topic_page', {
      topic_slug: topicSlug,
      topic_id: topicId,
      location: 'cta_bar'
    });
  };

  const currentPath = location.pathname + location.search;

  const ctaBarContent = (
    <div className={`flex flex-col sm:flex-row items-center gap-3 ${className}`}>
      {/* Follow Button */}
      <FollowTopicButton
        topicId={topicId}
        topicSlug={topicSlug}
        variant="default"
        size="sm"
      />

      {/* RSS Button */}
      <RssButton
        topicSlug={topicSlug}
        topicName={topicTitle}
        variant="outline"
        size="sm"
      />

      {/* Share Dropdown */}
      <DropdownMenu open={shareOpen} onOpenChange={setShareOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handleShare('linkedin')} className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Share on LinkedIn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('reddit')} className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Share on Reddit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('whatsapp')} className="cursor-pointer">
            <MessageCircle className="mr-2 h-4 w-4" />
            Share on WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('copy')} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Signup CTA for non-authenticated users */}
      {!session && (
        <Button asChild variant="default" size="sm" className="whitespace-nowrap gap-2">
          <Link 
            to={`/auth?redirect=${encodeURIComponent(currentPath)}`}
            onClick={handleSignupClick}
          >
            <UserPlus className="h-4 w-4" />
            Get Daily Drops
          </Link>
        </Button>
      )}
    </div>
  );

  if (sticky) {
    return (
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          {ctaBarContent}
        </div>
      </div>
    );
  }

  return ctaBarContent;
};