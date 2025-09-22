import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Share2, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackShare, generateShareMessage, getShareUrls } from "@/lib/trackers/sharing";

interface ShareButtonProps {
  dropId: string;
  title: string;
  url: string;
  disabled?: boolean;
  className?: string;
}

export const ShareButton = ({ dropId, title, url, disabled, className }: ShareButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Pre-filled share message with clickable dailydrops.cloud link
  const shareMessage = generateShareMessage(url);
  const shareUrls = getShareUrls(title, url, shareMessage);

  const logShare = async (channel: 'linkedin' | 'reddit' | 'whatsapp' | 'copylink' | 'native') => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      // Use the tracking utility
      await trackShare({
        dropId,
        title,
        url,
        channel,
        userId
      });
    } catch (error) {
      console.error('Error in logShare:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return false;
    
    try {
      await navigator.share({
        title,
        text: shareMessage,
        url
      });
      await logShare('native');
      return true;
    } catch (error) {
      // User cancelled or error occurred
      return false;
    }
  };

  const handleLinkedInShare = () => {
    window.open(shareUrls.linkedin, '_blank', 'width=600,height=400');
    logShare('linkedin');
  };

  const handleRedditShare = () => {
    window.open(shareUrls.reddit, '_blank', 'width=600,height=400');
    logShare('reddit');
  };

  const handleWhatsAppShare = () => {
    window.open(shareUrls.whatsapp, '_blank');
    logShare('whatsapp');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      toast({
        title: "Link copied!",
        description: "Share message copied to clipboard",
      });
      logShare('copylink');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareMessage;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Link copied!",
        description: "Share message copied to clipboard",
      });
      logShare('copylink');
    }
  };

  const handleShareClick = async () => {
    // Try native share first on mobile
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const success = await handleNativeShare();
      if (success) return;
    }
    // Fallback handled by dropdown menu
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleShareClick}
          disabled={disabled || isLoading}
          className={`h-7 w-7 p-0 ${className}`}
          aria-label="Share article"
        >
          <Share2 className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleLinkedInShare} className="cursor-pointer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Share on LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleRedditShare} className="cursor-pointer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Share on Reddit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsAppShare} className="cursor-pointer">
          <MessageCircle className="mr-2 h-4 w-4" />
          Share on WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};