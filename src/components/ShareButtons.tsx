import { Button } from "@/components/ui/button";
import { Share2, MessageSquare } from "lucide-react";
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

  const shareText = `AI is moving fast 🚀 Today's curated Drop on ${topicName}: ${title} 👉`;

  const handleShare = (channel: 'linkedin' | 'reddit' | 'whatsapp') => {
    const urlWithUtm = addUtmToUrl(url, 'share', channel, 'topic');
    let shareUrl = '';

    switch (channel) {
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlWithUtm)}`;
        break;
      case 'reddit':
        shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(urlWithUtm)}&title=${encodeURIComponent(title)}`;
        break;
      case 'whatsapp':
        const textWithUrl = `${shareText} ${urlWithUtm}`;
        shareUrl = `https://wa.me/?text=${encodeURIComponent(textWithUrl)}`;
        break;
    }

    // Track the share event
    track('share_topic_clicked', { 
      channel,
      url: urlWithUtm,
      topic: topicName
    });

    // Open in new window
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground mr-1">Share:</span>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleShare('linkedin')}
        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
      >
        LinkedIn
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleShare('reddit')}
        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
      >
        Reddit
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleShare('whatsapp')}
        className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
      >
        <MessageSquare className="h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
};