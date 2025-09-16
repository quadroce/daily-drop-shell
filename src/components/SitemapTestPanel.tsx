import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, Globe, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SitemapTestResult {
  url: string;
  accessible: boolean;
  isValidXml: boolean;
  lastModified?: string;
  size?: number;
  error?: string;
}

interface IndexNowResult {
  success: boolean;
  statusCode: number;
  submitted: number;
  error?: string;
}

interface TestResults {
  indexnow: IndexNowResult;
  sitemaps: SitemapTestResult[];
  summary: {
    total_sitemaps: number;
    accessible_sitemaps: number;
    valid_xml_sitemaps: number;
    indexnow_success: boolean;
  };
}

export function SitemapTestPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);

  const runSitemapTest = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-sitemap-submissions');

      if (error) {
        console.error('Error testing sitemaps:', error);
        toast({
          title: "Errore test sitemap",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setResults(data);
      
      const { summary } = data;
      const success = summary.accessible_sitemaps === summary.total_sitemaps && summary.indexnow_success;
      
      toast({
        title: success ? "Test completato con successo" : "Test completato con avvisi",
        description: `${summary.accessible_sitemaps}/${summary.total_sitemaps} sitemap accessibili. IndexNow: ${summary.indexnow_success ? 'OK' : 'Errore'}`,
        variant: success ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Error during sitemap test:', error);
      toast({
        title: "Errore durante il test",
        description: "Si è verificato un errore durante il test delle sitemap",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Test Sitemap e IndexNow
            </CardTitle>
            <CardDescription>
              Verifica l'accessibilità delle sitemap e testa l'invio a Bing IndexNow
            </CardDescription>
          </div>
          
          <Button 
            onClick={runSitemapTest} 
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Avvia Test
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {results && (
          <>
            {/* Summary */}
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    <strong>Riepilogo:</strong> {results.summary.accessible_sitemaps}/{results.summary.total_sitemaps} sitemap accessibili, 
                    {results.summary.valid_xml_sitemaps} XML validi
                  </span>
                  <Badge variant={results.summary.indexnow_success ? "default" : "destructive"}>
                    IndexNow: {results.summary.indexnow_success ? 'OK' : 'Errore'}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>

            {/* IndexNow Results */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Send className="h-4 w-4" />
                Risultato IndexNow (Bing)
              </h4>
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={results.indexnow.success ? "default" : "destructive"}>
                    {results.indexnow.success ? 'Successo' : 'Errore'} (HTTP {results.indexnow.statusCode})
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">URL inviate:</span>
                  <span className="text-sm">{results.indexnow.submitted}</span>
                </div>
                {results.indexnow.error && (
                  <div className="text-sm text-destructive mt-2">
                    <strong>Errore:</strong> {results.indexnow.error}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Sitemap Details */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Dettagli Sitemap
              </h4>
              <div className="space-y-3">
                {results.sitemaps.map((sitemap, index) => (
                  <div key={index} className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate mr-2">
                        {sitemap.url.replace('https://dailydrops.cloud', '')}
                      </span>
                      <div className="flex gap-2">
                        <Badge variant={sitemap.accessible ? "default" : "destructive"} className="text-xs">
                          {sitemap.accessible ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {sitemap.accessible ? 'Accessibile' : 'Non accessibile'}
                        </Badge>
                        {sitemap.accessible && (
                          <Badge variant={sitemap.isValidXml ? "default" : "secondary"} className="text-xs">
                            {sitemap.isValidXml ? 'XML valido' : 'XML non valido'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {sitemap.accessible && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {sitemap.size && (
                          <div>Dimensione: {formatBytes(sitemap.size)}</div>
                        )}
                        {sitemap.lastModified && (
                          <div>Ultima modifica: {formatDate(sitemap.lastModified)}</div>
                        )}
                      </div>
                    )}
                    
                    {sitemap.error && (
                      <div className="text-xs text-destructive mt-2">
                        <strong>Errore:</strong> {sitemap.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Info Panel */}
            <Alert>
              <AlertDescription className="text-xs">
                <strong>Note:</strong> Questo test verifica che le sitemap siano accessibili pubblicamente e le invia a Bing tramite IndexNow. 
                Per Google, le sitemap vengono scoperte automaticamente tramite robots.txt o possono essere inviate manualmente tramite Google Search Console.
              </AlertDescription>
            </Alert>
          </>
        )}

        {!results && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Clicca "Avvia Test" per verificare le sitemap e testare IndexNow</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}