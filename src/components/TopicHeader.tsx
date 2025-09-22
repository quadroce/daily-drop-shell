import { useAuth } from "@/hooks/useAuth";
import { FollowTopicButton } from "@/components/FollowTopicButton";
import { RssButton } from "@/components/RssButton";
import { ShareButtons } from "@/components/ShareButtons";
import { SignupCta } from "@/components/SignupCta";

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
    <header className="mb-8">
      <h1 className="text-4xl font-bold text-foreground mb-4">{topicTitle}</h1>
      
      {topicIntro && (
        <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed mb-6">
          <p>{topicIntro}</p>
        </div>
      )}

      {/* CTAs Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
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
          
          <ShareButtons
            url={currentUrl}
            title={topicTitle}
            topicName={topicTitle}
          />
        </div>
        
        {!session && (
          <SignupCta
            topicSlug={topicSlug}
            variant="outline"
            className="sm:ml-auto"
          />
        )}
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