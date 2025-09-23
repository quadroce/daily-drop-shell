import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';

export function FeedCacheRefresh() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mostra il pulsante solo per admin e superadmin
  const canRefreshCache = profile?.role === 'admin' || profile?.role === 'superadmin';

  if (!canRefreshCache) {
    return null;
  }

  const refreshUserCache = async () => {
    if (!user?.id) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per rigenerare la cache",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRefreshing(true);
      
      console.log('🔄 Rigenerando cache per utente:', user.id);
      
      // Prima prova con content-ranking con refresh_cache=true
      const { data: rankingData, error: rankingError } = await supabase.functions.invoke('content-ranking', {
        body: { 
          refresh_cache: true,
          limit: 50
        }
      });
      
      if (rankingError) {
        console.error('❌ Errore content-ranking:', rankingError);
        
        // Se fallisce, prova con manual-user-cache
        const { data: manualData, error: manualError } = await supabase.functions.invoke('manual-user-cache', {
          body: { 
            user_id: user.id 
          }
        });
        
        if (manualError) {
          throw manualError;
        }
        
        console.log('✅ Cache rigenerata tramite manual-user-cache:', manualData);
        toast({
          title: "Cache rigenerata",
          description: `Cache personalizzata rigenerata con ${manualData?.cache_items || 0} elementi`,
        });
      } else {
        console.log('✅ Cache rigenerata tramite content-ranking:', rankingData);
        toast({
          title: "Cache rigenerata", 
          description: "Feed personalizzato rigenerato con successo",
        });
      }
      
      // Ricarica la pagina per vedere i nuovi risultati
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Errore durante la rigenerazione:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante la rigenerazione della cache",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        onClick={refreshUserCache}
        disabled={isRefreshing}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isRefreshing ? 'Rigenerando...' : '🔄 Rigenera Feed Personalizzato'}
      </Button>
    </div>
  );
}