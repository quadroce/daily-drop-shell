import { Button } from "@/components/ui/button";
import { Rss } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";

interface RssButtonProps {
  topicSlug: string;
  topicName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}

export const RssButton = ({ 
  topicSlug, 
  topicName,
  variant = "outline", 
  size = "default" 
}: RssButtonProps) => {
  const { track } = useAnalytics();

  const handleRssClick = () => {
    const rssUrl = `https://dailydrops.cloud/rss-feed/topics/${topicSlug}.rss`;
    
    // Track RSS subscription
    track('rss_subscribed_topic', { 
      topic_slug: topicSlug,
      topic_name: topicName
    });

    // Open RSS feed in new tab
    window.open(rssUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button
      onClick={handleRssClick}
      variant={variant}
      size={size}
      className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
    >
      <Rss className="h-3 w-3 sm:h-4 sm:w-4" />
      <span className="hidden xs:inline">RSS Feed</span>
      <span className="xs:hidden">RSS</span>
    </Button>
  );
};