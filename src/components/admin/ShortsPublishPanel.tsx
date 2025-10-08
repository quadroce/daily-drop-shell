import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Youtube, Linkedin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function ShortsPublishPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [dropId, setDropId] = useState('');
  const [style, setStyle] = useState<'recap' | 'highlight'>('recap');
  const [platform, setPlatform] = useState<'youtube' | 'linkedin'>('youtube');
  const [result, setResult] = useState<any>(null);

  const publishVideo = async () => {
    if (!dropId) {
      toast.error('Inserisci un Drop ID');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const functionName = platform === 'youtube' 
        ? 'youtube-shorts-publish' 
        : 'linkedin-shorts-publish';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { dropId: parseInt(dropId), style }
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success(`Video pubblicato su ${platform === 'youtube' ? 'YouTube' : 'LinkedIn'}!`);
      } else {
        toast.error(data.error || 'Pubblicazione fallita');
      }
    } catch (error: any) {
      console.error('Publish error:', error);
      toast.error(error.message || 'Errore durante la pubblicazione');
      setResult({ success: false, error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Pubblica Video Shorts
          </h3>
          <p className="text-sm text-muted-foreground">
            Genera e pubblica video Shorts su YouTube o LinkedIn usando OpenAI GPT-5.
          </p>
        </div>

        <Tabs value={platform} onValueChange={(v: any) => setPlatform(v)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="youtube" className="flex items-center gap-2">
              <Youtube className="h-4 w-4" />
              YouTube
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="flex items-center gap-2">
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="space-y-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <strong>YouTube Shorts:</strong> Video verticale 1080x1920, 45-60s, con CTA e UTM tracking
              </div>
            </div>
          </TabsContent>

          <TabsContent value="linkedin" className="space-y-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <strong>LinkedIn Video:</strong> Video quadrato/verticale, 15-30s, tono professionale, con captions
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dropId">Drop ID</Label>
              <Input
                id="dropId"
                type="number"
                placeholder="es. 34893"
                value={dropId}
                onChange={(e) => setDropId(e.target.value)}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select value={style} onValueChange={(v: any) => setStyle(v)} disabled={isRunning}>
                <SelectTrigger id="style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recap">Recap (informativo)</SelectItem>
                  <SelectItem value="highlight">Highlight (entusiasta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={publishVideo} 
            disabled={isRunning || !dropId}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pubblicazione in corso...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Pubblica su {platform === 'youtube' ? 'YouTube' : 'LinkedIn'}
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <h4 className="font-semibold">
                {result.success ? 'Pubblicazione Completata' : 'Errore'}
              </h4>
            </div>

            {result.success && (
              <>
                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>Demo Mode:</strong> {result.note}
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-3">
                  {platform === 'youtube' && (
                    <>
                      <div>
                        <div className="text-sm font-medium mb-1">Video ID</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {result.videoId}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Script Generato</div>
                        <div className="bg-background p-3 rounded text-sm max-h-32 overflow-y-auto border">
                          {result.script.text}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.script.words} parole
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Metadata</div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="font-medium">{result.metadata.title}</div>
                          <div className="mt-1">{result.metadata.description}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {platform === 'linkedin' && (
                    <>
                      <div>
                        <div className="text-sm font-medium mb-1">Post ID</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {result.postId}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Post Text</div>
                        <div className="bg-background p-3 rounded text-sm max-h-32 overflow-y-auto border">
                          {result.postText}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Video URN</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {result.videoUrn}
                        </div>
                      </div>
                    </>
                  )}

                  {result.quotaCost && (
                    <div className="pt-2 border-t">
                      <div className="text-xs font-medium text-muted-foreground">
                        Costo quota YouTube: {result.quotaCost} unità
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Next Steps (Produzione)
                  </div>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    {result.nextSteps?.map((step: string, i: number) => (
                      <li key={i}>• {step}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {!result.success && (
              <div className="bg-destructive/10 p-4 rounded-lg">
                <div className="text-sm text-destructive">
                  {result.error || result.message || 'Errore sconosciuto'}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
          <div className="font-medium">ℹ️ Informazioni</div>
          <ul className="space-y-1 ml-4">
            <li>• Usa OpenAI GPT-5 per generare script professionali</li>
            <li>• Demo mode: genera script e metadata ma non carica video reali</li>
            <li>• In produzione: Google Cloud TTS + FFmpeg per video completi</li>
            <li>• Tracking UTM automatico per analytics</li>
            <li>• Tutti gli eventi sono loggati in short_job_events</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
