import { Button } from "@/components/ui/button";
import { Share2, MessageSquare, ExternalLink } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { addUtmToUrl } from "@/lib/utils/utm";

interface ShareButtonsProps {
  url: string;
  title: string;
  topicName: string;
  className?: string;
}

export const ShareButtons = ({ 
  url, 
  title, 
  topicName,
  className = "" 
}: ShareButtonsProps) => {
  const { track } = useAnalytics();

  // Updated share text to match specifications
  const shareText = `AI moves fast 🚀 Today's curated Drop on ${topicName}: ${title} 👉`;

  const handleShare = (channel: 'linkedin' | 'reddit' | 'whatsapp') => {
    const urlWithUtm = addUtmToUrl(url, 'share', channel, 'topic');
    let shareUrl = '';

    switch (channel) {
      case 'linkedin':
        // Updated to use new LinkedIn share URL format
        const linkedinText = `${shareText} ${urlWithUtm}`;
        shareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedinText)}`;
        break;
      case 'reddit':
        shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(urlWithUtm)}&title=${encodeURIComponent(title)}`;
        break;
      case 'whatsapp':
        const textWithUrl = `${shareText} ${urlWithUtm}`;
        shareUrl = `https://wa.me/?text=${encodeURIComponent(textWithUrl)}`;
        break;
    }

    // Track the share event with enhanced analytics
    track('share_topic_clicked', { 
      channel,
      url: urlWithUtm,
      topic: topicName,
      topic_slug: url.split('/topics/')[1]?.split('/')[0] || 'unknown'
    });

    // Open in new window
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 ${className}`}>
      <span className="text-xs sm:text-sm text-muted-foreground">Share:</span>
      
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('linkedin')}
          className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 gap-1 text-xs sm:text-sm px-2 sm:px-3"
        >
          <ExternalLink className="h-3 w-3" />
          <span className="hidden xs:inline">LinkedIn</span>
          <span className="xs:hidden">LI</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('reddit')}
          className="text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50 gap-1 text-xs sm:text-sm px-2 sm:px-3"
        >
          <ExternalLink className="h-3 w-3" />
          <span className="hidden xs:inline">Reddit</span>
          <span className="xs:hidden">RD</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('whatsapp')}
          className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 gap-1 text-xs sm:text-sm px-2 sm:px-3"
        >
          <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">WhatsApp</span>
          <span className="xs:hidden">WA</span>
        </Button>
      </div>
    </div>
  );
};