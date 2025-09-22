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
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground mr-1">Share:</span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('linkedin')}
        className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
      >
        <ExternalLink className="h-3 w-3" />
        LinkedIn
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('reddit')}
        className="text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50 gap-1"
      >
        <ExternalLink className="h-3 w-3" />
        Reddit
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('whatsapp')}
        className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 gap-1"
      >
        <MessageSquare className="h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
};