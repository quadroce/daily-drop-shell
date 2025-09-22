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
      className="gap-2"
    >
      <Rss className="h-4 w-4" />
      RSS Feed
    </Button>
  );
};