import { useState } from "react";
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

  const handleFollow = async () => {
    if (!session) {
      // Redirect to auth with current page as redirect
      const currentPath = location.pathname + location.search;
      navigate(`/auth?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    setIsPending(true);
    
    try {
      if (!isFollowing) {
        // Follow the topic
        const { error } = await supabase
          .from('user_topic_preferences')
          .upsert({
            user_id: session.user.id,
            topic_id: topicId,
            level: 1, // Assuming level 1 for now, could be dynamic
            priority: 1
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
        // Unfollow the topic
        const { error } = await supabase
          .from('user_topic_preferences')
          .delete()
          .eq('user_id', session.user.id)
          .eq('topic_id', topicId);

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
      className="gap-2"
    >
      {isFollowing ? (
        <>
          <HeartOff className="h-4 w-4" />
          {isPending ? "Unfollowing..." : "Following"}
        </>
      ) : (
        <>
          <Heart className="h-4 w-4" />
          {isPending ? "Following..." : "Follow Topic"}
        </>
      )}
    </Button>
  );
};