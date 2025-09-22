import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart, HeartOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/lib/analytics";

interface FollowTopicButtonProps {
  topicId: number;
  topicSlug: string;
  initialIsFollowing?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}

const SAVED_TOPICS_KEY = 'dailydrops_saved_topics';

export const FollowTopicButton = ({ 
  topicId, 
  topicSlug,
  initialIsFollowing = false,
  variant = "outline",
  size = "default"
}: FollowTopicButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, setIsPending] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { track } = useAnalytics();

  // Check if user is following this topic on mount
  useEffect(() => {
    const checkFollowingStatus = async () => {
      if (session?.user) {
        // Logged in user - check preferences
        try {
          const { data } = await supabase
            .from('preferences')
            .select('selected_topic_ids')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          const isFollowingTopic = data?.selected_topic_ids?.includes(topicId) || false;
          setIsFollowing(isFollowingTopic);
        } catch (error) {
          console.error('Error checking follow status:', error);
        }
      } else {
        // Non-logged user - check localStorage
        try {
          const savedTopics = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) || '[]');
          setIsFollowing(savedTopics.includes(topicId));
        } catch (error) {
          console.error('Error reading saved topics:', error);
        }
      }
    };

    checkFollowingStatus();
  }, [session?.user, topicId]);

  const handleFollow = async () => {
    if (!session) {
      // Save topic to localStorage for non-logged users
      try {
        const savedTopics = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) || '[]');
        const updatedTopics = isFollowing 
          ? savedTopics.filter((id: number) => id !== topicId)
          : [...savedTopics, topicId];
        
        localStorage.setItem(SAVED_TOPICS_KEY, JSON.stringify(updatedTopics));
        setIsFollowing(!isFollowing);
        
        toast({
          title: isFollowing ? "Topic saved" : "Following topic",
          description: isFollowing 
            ? "Topic removed from your saved list."
            : "Sign up to save this topic to your feed!"
        });
        
        track(isFollowing ? 'unfollow_topic_clicked' : 'follow_topic_clicked', { 
          topic_slug: topicSlug, 
          topic_id: topicId.toString() 
        });
        
        // Redirect to auth after a short delay
        setTimeout(() => {
          const currentPath = location.pathname + location.search;
          navigate(`/auth?redirect=${encodeURIComponent(currentPath)}`);
        }, 1500);
      } catch (error) {
        console.error('Error saving topic locally:', error);
      }
      return;
    }

    setIsPending(true);
    
    try {
      // Get current preferences
      const { data: currentPrefs } = await supabase
        .from('preferences')
        .select('selected_topic_ids, selected_language_ids')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const currentTopicIds = currentPrefs?.selected_topic_ids || [];
      const currentLanguageIds = currentPrefs?.selected_language_ids || [];

      if (!isFollowing) {
        // Follow the topic - add to array
        const updatedTopicIds = [...currentTopicIds, topicId];
        
        const { error } = await supabase
          .from('preferences')
          .upsert({
            user_id: session.user.id,
            selected_topic_ids: updatedTopicIds,
            selected_language_ids: currentLanguageIds,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        setIsFollowing(true);
        toast({
          title: "Following topic",
          description: `You'll now see more content about this topic in your feed.`
        });
        
        track('follow_topic_clicked', { 
          topic_slug: topicSlug, 
          topic_id: topicId.toString() 
        });
      } else {
        // Unfollow the topic - remove from array
        const updatedTopicIds = currentTopicIds.filter((id: number) => id !== topicId);
        
        const { error } = await supabase
          .from('preferences')
          .upsert({
            user_id: session.user.id,
            selected_topic_ids: updatedTopicIds,
            selected_language_ids: currentLanguageIds,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;

        setIsFollowing(false);
        toast({
          title: "Unfollowed topic",
          description: "You'll see less content about this topic in your feed."
        });
        
        track('unfollow_topic_clicked', { 
          topic_slug: topicSlug, 
          topic_id: topicId.toString() 
        });
      }
    } catch (error) {
      console.error('Error updating topic preference:', error);
      toast({
        title: "Error",
        description: "Could not update topic preference. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      onClick={handleFollow}
      variant={variant}
      size={size}
      disabled={isPending}
      className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
    >
      {isFollowing ? (
        <>
          <HeartOff className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">
            {isPending ? "Unfollowing..." : session ? "Following" : "Saved"}
          </span>
          <span className="xs:hidden">
            {isPending ? "..." : "✓"}
          </span>
        </>
      ) : (
        <>
          <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">
            {isPending ? "Following..." : session ? "Follow Topic" : "Follow Topic"}
          </span>
          <span className="xs:hidden">
            {isPending ? "..." : "Follow"}
          </span>
        </>
      )}
    </Button>
  );
};