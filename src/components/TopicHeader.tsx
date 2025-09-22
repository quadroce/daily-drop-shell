import { useAuth } from "@/hooks/useAuth";
import { FollowTopicButton } from "@/components/FollowTopicButton";
import { RssButton } from "@/components/RssButton";
import { ShareButtons } from "@/components/ShareButtons";
import { SignupCta } from "@/components/SignupCta";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface TopicHeaderProps {
  topicId: number;
  topicSlug: string;
  topicTitle: string;
  topicIntro?: string;
  level: number;
  showPreview?: boolean;
}

export const TopicHeader = ({
  topicId,
  topicSlug,
  topicTitle,
  topicIntro,
  level,
  showPreview = false
}: TopicHeaderProps) => {
  const { session } = useAuth();
  // Use canonical URL for consistent sharing without UTM parameters
  const currentUrl = `https://dailydrops.cloud/topics/${topicSlug}`;

  return (
    <header className="mb-6 sm:mb-8">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">{topicTitle}</h1>
      
      {topicIntro && (
        <div className="prose prose-sm sm:prose-lg max-w-none text-muted-foreground leading-relaxed mb-4 sm:mb-6">
          <p className="text-sm sm:text-base">{topicIntro}</p>
        </div>
      )}

      {/* CTAs Row */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Primary Actions Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <FollowTopicButton
              topicId={topicId}
              topicSlug={topicSlug}
              variant="default"
            />
            
            <RssButton
              topicSlug={topicSlug}
              topicName={topicTitle}
              variant="outline"
            />
            
            <Button variant="outline" asChild size="sm" className="flex-shrink-0">
              <Link to={`/topics/${topicSlug}/archive`}>View Archive</Link>
            </Button>
          </div>
          
          {!session && (
            <SignupCta
              topicSlug={topicSlug}
              variant="outline"
              className="sm:ml-auto w-full sm:w-auto"
              size="sm"
            />
          )}
        </div>
        
        {/* Share Buttons Row - Mobile: Full width, Desktop: Inline */}
        <div className="flex items-center justify-start">
          <ShareButtons
            url={currentUrl}
            title={topicTitle}
            topicName={topicTitle}
          />
        </div>
      </div>

      {showPreview && !session && (
        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Showing preview content (3-5 items). Sign up to get the full feed with personalized content.
          </p>
        </div>
      )}
    </header>
  );
};