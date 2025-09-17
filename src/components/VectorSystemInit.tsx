import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';
import { initializeVectorSystem, refreshUserProfile } from '@/lib/vector-init';
import { toast } from 'sonner';

export function VectorSystemInit() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initResult, setInitResult] = useState<any>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<any>(null);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const result = await initializeVectorSystem();
      setInitResult(result);
      
      if (result.success) {
        toast.success('Sistema vector inizializzato con successo!');
      } else {
        toast.error(`Errore: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Errore nell'inizializzazione: ${error.message}`);
      setInitResult({ success: false, error: error.message });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRefreshProfile = async () => {
    setIsRefreshingProfile(true);
    try {
      const result = await refreshUserProfile();
      setProfileResult(result);
      
      if (result.success) {
        toast.success('Profilo utente aggiornato!');
      } else {
        toast.error('Errore nell\'aggiornamento del profilo');
      }
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
      setProfileResult({ success: false, error: error.message });
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Attivazione Sistema Vector
          </CardTitle>
          <CardDescription>
            Inizializza il sistema di personalizzazione basato su embedding AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleInitialize} 
              disabled={isInitializing}
              className="w-fit"
            >
              {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isInitializing ? 'Inizializzazione...' : 'Inizializza Embeddings'}
            </Button>
            
            {initResult && (
              <div className="flex items-center gap-2 text-sm">
                {initResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="secondary">Successo</Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Errore</Badge>
                  </>
                )}
              </div>
            )}
          </div>

          {initResult?.success && (
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleRefreshProfile} 
                disabled={isRefreshingProfile}
                variant="outline"
                className="w-fit"
              >
                {isRefreshingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRefreshingProfile ? 'Aggiornamento...' : 'Aggiorna Profilo Utente'}
              </Button>
              
              {profileResult && (
                <div className="flex items-center gap-2 text-sm">
                  {profileResult.success ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary">Profilo Aggiornato</Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <Badge variant="destructive">Errore Profilo</Badge>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {initResult && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(initResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}