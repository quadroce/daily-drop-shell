import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Youtube, Linkedin, CheckCircle, XCircle, AlertCircle, Sparkles, Mic, Video, Cloud } from 'lucide-react';

export function ShortsPublishPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [dropId, setDropId] = useState('');
  const [style, setStyle] = useState<'recap' | 'highlight'>('recap');
  const [platform, setPlatform] = useState<'youtube' | 'linkedin'>('youtube');
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const publishVideo = async () => {
    if (!dropId) {
      toast.error('Inserisci un Drop ID');
      return;
    }

    setIsRunning(true);
    setResult(null);
    setProgress(0);

    try {
      const functionName = platform === 'youtube' 
        ? 'youtube-shorts-publish' 
        : 'linkedin-shorts-publish';

      // Simulate progress updates
      const progressSteps = [
        { step: '📝 Generazione script...', progress: 20 },
        { step: '🎤 Creazione audio TTS...', progress: 40 },
        { step: '🎬 Rendering video...', progress: 60 },
        { step: '☁️ Upload in corso...', progress: 80 },
        { step: '✅ Pubblicazione...', progress: 95 }
      ];

      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (currentProgress < progressSteps.length) {
          setCurrentStep(progressSteps[currentProgress].step);
          setProgress(progressSteps[currentProgress].progress);
          currentProgress++;
        }
      }, 3000);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { dropId: parseInt(dropId), style }
      });

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentStep('');

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
      setProgress(0);
      setCurrentStep('');
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
                <strong>YouTube Shorts:</strong> Video verticale 1080x1920, MAX 30s, con CTA e UTM tracking
              </div>
            </div>
          </TabsContent>

          <TabsContent value="linkedin" className="space-y-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <strong>LinkedIn Video:</strong> Video quadrato/verticale, MAX 30s, tono professionale, con captions
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

          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              {currentStep && (
                <div className="text-sm text-muted-foreground text-center">
                  {currentStep}
                </div>
              )}
            </div>
          )}
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
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
                    <div className="font-semibold">{result.note || 'Video pubblicato con successo!'}</div>
                    {result.videoUrl && (
                      <a 
                        href={result.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        🔗 Visualizza su {platform === 'youtube' ? 'YouTube' : 'LinkedIn'}
                      </a>
                    )}
                    {result.postUrl && (
                      <a 
                        href={result.postUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        🔗 Visualizza post LinkedIn
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Script */}
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <div className="text-sm font-medium">Script (GPT-5)</div>
                    </div>
                    <div className="bg-background p-2 rounded text-xs max-h-32 overflow-y-auto border">
                      {result.script.text}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.script.words} parole • {result.script.estimatedDuration}
                    </div>
                  </Card>

                  {/* Audio */}
                  {result.audio && (
                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="h-4 w-4 text-blue-500" />
                        <div className="text-sm font-medium">Audio TTS</div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>🎙️ {result.audio.voice}</div>
                        <div>⏱️ {result.audio.duration}</div>
                        {result.audio.size && <div>📦 {result.audio.size}</div>}
                      </div>
                    </Card>
                  )}

                  {/* Video */}
                  {result.video && (
                    <Card className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="h-4 w-4 text-red-500" />
                        <div className="text-sm font-medium">Video</div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>✅ {result.video.status}</div>
                        <div>📐 {result.video.format}</div>
                        {result.video.size && <div>📦 {result.video.size}</div>}
                        {result.video.renderId && (
                          <div className="font-mono text-[10px] break-all">
                            ID: {result.video.renderId}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Platform */}
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="h-4 w-4 text-green-500" />
                      <div className="text-sm font-medium">{platform === 'youtube' ? 'YouTube' : 'LinkedIn'}</div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {result.videoId && <div>🎬 Video ID: {result.videoId}</div>}
                      {result.postUrn && <div>📝 Post URN: {result.postUrn.substring(0, 30)}...</div>}
                      {result.assetUrn && <div>🎥 Asset URN: {result.assetUrn.substring(0, 30)}...</div>}
                      {result.quotaCost && <div>💰 Quota: {result.quotaCost} unità</div>}
                    </div>
                  </Card>
                </div>

                {/* Metadata (solo YouTube) */}
                {platform === 'youtube' && result.metadata && (
                  <Card className="p-3">
                    <div className="text-sm font-medium mb-2">Metadata YouTube</div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="font-medium text-muted-foreground">Titolo:</div>
                        <div>{result.metadata.title}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">Descrizione:</div>
                        <div className="bg-background p-2 rounded max-h-20 overflow-y-auto border">
                          {result.metadata.description}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Post Text (solo LinkedIn) */}
                {platform === 'linkedin' && result.postText && (
                  <Card className="p-3">
                    <div className="text-sm font-medium mb-2">Testo Post</div>
                    <div className="bg-background p-2 rounded text-xs max-h-24 overflow-y-auto border">
                      {result.postText}
                    </div>
                  </Card>
                )}
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

        <div className="text-xs text-muted-foreground space-y-2 border-t pt-4">
          <div className="font-medium">ℹ️ Sistema di Pubblicazione Video</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-muted/50 p-2 rounded">
              <div className="font-medium mb-1">✅ Funzionalità Attive</div>
              <ul className="space-y-0.5 ml-4 text-[11px]">
                <li>• Script generation con GPT-5 (max 30s)</li>
                <li>• Audio TTS con Google Cloud</li>
                <li>• Video rendering con Shotstack</li>
                <li>• Upload YouTube con OAuth</li>
                <li>• Upload LinkedIn con API v2</li>
                <li>• Tracking UTM automatico</li>
              </ul>
            </div>
            <div className="bg-muted/50 p-2 rounded">
              <div className="font-medium mb-1">🔧 Specifiche Tecniche</div>
              <ul className="space-y-0.5 ml-4 text-[11px]">
                <li>• YouTube: 1080x1920 (9:16), 30fps</li>
                <li>• LinkedIn: 1080x1080 (1:1), 30fps</li>
                <li>• Format: MP4, H.264</li>
                <li>• Audio: MP3, 128kbps</li>
                <li>• Max duration: 30 secondi</li>
                <li>• Logs in admin_audit_log</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
