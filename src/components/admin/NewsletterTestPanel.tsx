import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, RefreshCw, User } from 'lucide-react';

export function NewsletterTestPanel() {
  const { toast } = useToast();
  const [isTestingNewsletter, setIsTestingNewsletter] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [testUserId, setTestUserId] = useState('637fc77f-93aa-488a-a0e1-ebd00826d4b3');
  const [testResults, setTestResults] = useState<any>(null);

  const refreshUserCache = async () => {
    try {
      setIsRefreshingCache(true);
      
      const { data, error } = await supabase.functions.invoke('manual-user-cache', {
        body: { user_id: testUserId }
      });

      if (error) throw error;

      toast({
        title: "Cache aggiornata",
        description: `Cache rigenerata per utente ${testUserId}`,
      });

      console.log('Cache refresh result:', data);
    } catch (error) {
      console.error('Error refreshing cache:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nella rigenerazione della cache",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingCache(false);
    }
  };

  const testNewsletter = async () => {
    try {
      setIsTestingNewsletter(true);
      
      console.log(`🧪 Testing newsletter for user: ${testUserId}`);
      
      // Step 1: Build digest
      const { data: buildData, error: buildError } = await supabase.functions.invoke('build-digest', {
        body: {
          userId: testUserId,
          cadence: 'daily',
          slot: 'morning',
          testMode: true
        }
      });

      if (buildError) throw new Error(`Build digest failed: ${buildError.message}`);
      if (!buildData?.success) throw new Error(`Build digest failed: ${buildData?.error}`);

      console.log('✅ Build digest successful:', buildData);

      // Step 2: Send email
      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-email-digest', {
        body: {
          userId: testUserId,
          digestContent: buildData.digestContent,
          testMode: true
        }
      });

      if (sendError) throw new Error(`Send email failed: ${sendError.message}`);
      if (!sendData?.success) throw new Error(`Send email failed: ${sendData?.error}`);

      console.log('✅ Send email successful:', sendData);

      setTestResults({
        buildResult: buildData,
        sendResult: sendData,
        success: true
      });

      toast({
        title: "Newsletter Test Completato",
        description: `Newsletter di test inviata con successo a ${testUserId}`,
      });

    } catch (error) {
      console.error('❌ Newsletter test failed:', error);
      
      setTestResults({
        error: error.message,
        success: false
      });

      toast({
        title: "Errore nel Test Newsletter",
        description: error.message || "Test della newsletter fallito",
        variant: "destructive",
      });
    } finally {
      setIsTestingNewsletter(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Newsletter Test Panel</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">User ID per Test:</label>
            <div className="flex gap-2">
              <Input
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="UUID utente"
                className="font-mono text-sm"
              />
              <Button
                onClick={refreshUserCache}
                disabled={isRefreshingCache}
                variant="outline"
                size="sm"
              >
                {isRefreshingCache ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Cache
              </Button>
            </div>
          </div>

          <Button
            onClick={testNewsletter}
            disabled={isTestingNewsletter || !testUserId}
            className="w-full"
          >
            {isTestingNewsletter ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando Newsletter...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Test Newsletter Completo
              </>
            )}
          </Button>

          {testResults && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Risultati Test:</h4>
              {testResults.success ? (
                <div className="space-y-2 text-sm">
                  <div className="text-green-600">✅ Test completato con successo</div>
                  <div>📊 Articoli nel digest: {testResults.buildResult?.itemCount || 0}</div>
                  <div>🎯 Algoritmo usato: {testResults.buildResult?.algorithmSource || 'unknown'}</div>
                  <div>📧 Email inviata: {testResults.sendResult ? 'Sì' : 'No'}</div>
                </div>
              ) : (
                <div className="text-red-600 text-sm">
                  ❌ Errore: {testResults.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}