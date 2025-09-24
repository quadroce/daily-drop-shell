import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RefreshUserCacheProps {
  userId: string;
  onRefreshComplete?: () => void;
}

export function RefreshUserCache({ userId, onRefreshComplete }: RefreshUserCacheProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshUserCache = async () => {
    try {
      setIsRefreshing(true);
      
      console.log('🔄 Refreshing cache for user:', userId);
      
      // Call content-ranking with refresh_cache=true
      const { data, error } = await supabase.functions.invoke('content-ranking', {
        body: { 
          refresh_cache: true,
          user_id: userId,
          limit: 50
        }
      });
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Cache refreshed successfully:', data);
      toast({
        title: "Cache Refreshed",
        description: `Feed cache regenerated for user ${userId}`,
      });
      
      // Call the completion callback if provided
      onRefreshComplete?.();
      
    } catch (error) {
      console.error('❌ Error refreshing cache:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to refresh cache",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button 
      onClick={refreshUserCache}
      disabled={isRefreshing}
      variant="outline"
      size="sm"
    >
      {isRefreshing ? 'Refreshing...' : '🔄 Refresh Cache'}
    </Button>
  );
}