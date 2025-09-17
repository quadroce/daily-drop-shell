import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Play, CheckCircle, XCircle, Database, Users, Clock, TrendingUp } from 'lucide-react';
import { initializeVectorSystem, refreshUserProfile } from '@/lib/vector-init';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function VectorSystemInit() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initResult, setInitResult] = useState<any>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<any>(null);
  const [isProcessingBacklog, setIsProcessingBacklog] = useState(false);
  const [backlogResult, setBacklogResult] = useState<any>(null);
  const [embeddingStats, setEmbeddingStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Load embedding stats on component mount
  useEffect(() => {
    loadEmbeddingStats();
  }, []);

  const loadEmbeddingStats = async () => {
    setIsLoadingStats(true);
    try {
      const { data, error } = await supabase.functions.invoke('automated-embeddings', {
        body: { action: 'stats' }
      });

      if (error) throw error;

      if (data?.success) {
        setEmbeddingStats(data.result);
      }
    } catch (error: any) {
      console.error('Failed to load embedding stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

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

  const handleProcessBacklog = async () => {
    setIsProcessingBacklog(true);
    try {
      const { data, error } = await supabase.functions.invoke('automated-embeddings', {
        body: { action: 'backlog' }
      });

      if (error) throw error;

      setBacklogResult(data);
      
      if (data?.success) {
        toast.success('Backlog embeddings processato con successo!');
        // Reload stats after processing backlog
        await loadEmbeddingStats();
      } else {
        toast.error('Errore nel processare il backlog');
      }
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
      setBacklogResult({ success: false, error: error.message });
    } finally {
      setIsProcessingBacklog(false);
    }
  };

  const handleProcessRecentEmbeddings = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('automated-embeddings', {
        body: { action: 'embeddings', since_minutes: 60 }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Embeddings recenti processati!');
        await loadEmbeddingStats();
      } else {
        toast.error('Errore nel processare embeddings recenti');
      }
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
    }
  };

  const handleRefreshAllProfiles = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('automated-embeddings', {
        body: { action: 'profiles' }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`${data.result.successful} profili aggiornati con successo!`);
      } else {
        toast.error('Errore nel refresh dei profili');
      }
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Embedding Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Stato Sistema Embeddings
          </CardTitle>
          <CardDescription>
            Monitoraggio dello stato degli embeddings e dei profili utente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Button 
              onClick={loadEmbeddingStats} 
              variant="outline" 
              size="sm"
              disabled={isLoadingStats}
            >
              {isLoadingStats && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aggiorna Statistiche
            </Button>
          </div>
          
          {embeddingStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Drops Totali</div>
                <div className="text-2xl font-bold">{embeddingStats.total_drops}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Con Embeddings</div>
                <div className="text-2xl font-bold text-green-600">{embeddingStats.embedded_drops}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Mancanti</div>
                <div className="text-2xl font-bold text-orange-600">{embeddingStats.missing_embeddings}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Profili Utente</div>
                <div className="text-2xl font-bold text-blue-600">{embeddingStats.user_profiles}</div>
              </div>
              <div className="col-span-2 lg:col-span-4">
                <div className="text-sm text-muted-foreground mb-2">Completamento Embeddings</div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div 
                    className="bg-primary h-3 rounded-full transition-all duration-500" 
                    style={{ width: `${embeddingStats.embedding_percentage}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {embeddingStats.embedding_percentage}% completato
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Manual Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Operazioni Manuali
          </CardTitle>
          <CardDescription>
            Controlli manuali per inizializzazione e test del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Initialize System */}
            <div className="space-y-2">
              <Button 
                onClick={handleInitialize} 
                disabled={isInitializing}
                className="w-full"
                variant="default"
              >
                {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Sistema Embeddings
              </Button>
              {initResult && (
                <div className="flex items-center gap-2 text-sm">
                  {initResult.success ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary">Test Completato</Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <Badge variant="destructive">Test Fallito</Badge>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Process Recent Embeddings */}
            <div className="space-y-2">
              <Button 
                onClick={handleProcessRecentEmbeddings} 
                className="w-full"
                variant="outline"
              >
                <Clock className="mr-2 h-4 w-4" />
                Processa Ultimi 60min
              </Button>
            </div>

            {/* Single User Profile Refresh */}
            <div className="space-y-2">
              <Button 
                onClick={handleRefreshProfile} 
                disabled={isRefreshingProfile}
                variant="outline"
                className="w-full"
              >
                {isRefreshingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Users className="mr-2 h-4 w-4" />
                Refresh Profilo Corrente
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

            {/* All Users Profile Refresh */}
            <div className="space-y-2">
              <Button 
                onClick={handleRefreshAllProfiles} 
                className="w-full"
                variant="outline"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Refresh Tutti i Profili
              </Button>
            </div>
          </div>

          <Separator />

          {/* Process Backlog */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Processamento Backlog (30 giorni)</h4>
              <Button 
                onClick={handleProcessBacklog} 
                disabled={isProcessingBacklog}
                variant="secondary"
                className="w-full md:w-auto"
              >
                {isProcessingBacklog && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessingBacklog ? 'Processando Backlog...' : 'Processa Backlog Embeddings'}
              </Button>
              {backlogResult && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {backlogResult.success ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary">Backlog Completato</Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <Badge variant="destructive">Errore Backlog</Badge>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Debug Results */}
          {(initResult || profileResult || backlogResult) && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <h5 className="text-xs font-medium mb-2">Debug Info:</h5>
              <pre className="text-xs overflow-auto">
                {JSON.stringify({
                  initResult: initResult || null,
                  profileResult: profileResult || null, 
                  backlogResult: backlogResult || null
                }, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sistema Automatizzato
          </CardTitle>
          <CardDescription>
            Il sistema ora processa automaticamente embeddings e profili utente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <div className="font-medium text-green-900 dark:text-green-100">Embeddings Automatici</div>
                <div className="text-sm text-green-700 dark:text-green-300">Ogni ora (contenuti ultimi 90 minuti)</div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                Attivo
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <div className="font-medium text-blue-900 dark:text-blue-100">Refresh Profili</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Ogni giorno alle 2:00 AM</div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                Attivo
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div>
                <div className="font-medium text-purple-900 dark:text-purple-100">Backlog Cleanup</div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Ogni domenica alle 3:00 AM</div>
              </div>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                Attivo
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}