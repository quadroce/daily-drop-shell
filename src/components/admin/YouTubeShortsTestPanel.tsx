import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Video, Play, CheckCircle, XCircle } from 'lucide-react';

export function YouTubeShortsTestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [dropId, setDropId] = useState('');
  const [style, setStyle] = useState<'recap' | 'highlight'>('recap');
  const [result, setResult] = useState<any>(null);

  const runDryRun = async () => {
    if (!dropId) {
      toast.error('Please enter a drop ID');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('youtube-shorts-dry-run', {
        body: { dropId: parseInt(dropId), style }
      });

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success('Dry-run completato con successo!');
      } else {
        toast.error(data.error || 'Dry-run fallito');
      }
    } catch (error: any) {
      console.error('Dry-run error:', error);
      toast.error(error.message || 'Errore durante il dry-run');
      setResult({ success: false, error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">YouTube Shorts Generator - Test</h3>
          <p className="text-sm text-muted-foreground">
            Genera uno script per un video Shorts basato su un drop. Il dry-run non genera video reale né utilizza quota YouTube.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dropId">Drop ID</Label>
              <Input
                id="dropId"
                type="number"
                placeholder="es. 12345"
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
            onClick={runDryRun} 
            disabled={isRunning || !dropId}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Esegui Dry-Run
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
                {result.success ? 'Dry-Run Completato' : 'Errore'}
              </h4>
            </div>

            {result.success && (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Drop</div>
                    <div className="text-sm text-muted-foreground">
                      {result.drop.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ID: {result.drop.id} | Topics: {result.drop.topics}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Script Generato ({result.script.style})</div>
                    <div className="bg-background p-3 rounded text-sm whitespace-pre-wrap max-h-40 overflow-y-auto border">
                      {result.script.text}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.script.words} parole • {result.script.sentences} frasi • 
                      ~{result.script.estimated_duration_seconds}s • 
                      Generato in {result.script.generation_time_ms}ms
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Video Specs</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Risoluzione: {result.video.specs.resolution} @ {result.video.specs.fps} fps</div>
                      <div>Durata: ~{Math.round(result.video.specs.duration / 1000)}s</div>
                      <div>Formato: {result.video.specs.format} ({result.video.specs.codec})</div>
                      <div>Dimensione stimata: ~{result.video.specs.size_estimate_mb} MB</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Metadata YouTube</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="font-medium">{result.metadata.title}</div>
                      <div className="mt-1">{result.metadata.description}</div>
                      <div className="mt-1">Tags: {result.metadata.tags.join(', ')}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">CTA & UTM</div>
                    <div className="text-xs text-muted-foreground">
                      <div>{result.cta.text}</div>
                      <div className="text-primary mt-1 break-all">{result.cta.url}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground">
                      Costo quota YouTube stimato: {result.estimated_quota_cost} unità
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Next Steps
                  </div>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    {result.next_steps.map((step: string, i: number) => (
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
          <div className="font-medium">ℹ️ Informazioni Dry-Run</div>
          <ul className="space-y-1 ml-4">
            <li>• Non genera video reale né audio TTS</li>
            <li>• Non utilizza quota YouTube API</li>
            <li>• Usa Lovable AI (Gemini 2.5 Flash) per generare lo script</li>
            <li>• Fornisce stime su dimensioni e durata video</li>
            <li>• Ottimo per testare script e metadata prima dell'upload</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
