import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Globe, Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import RequireRole from "@/components/RequireRole";

interface IngestStatus {
  status: 'idle' | 'validating' | 'queuing' | 'processing' | 'success' | 'error' | 'exists';
  message?: string;
  queueId?: number;
  contentId?: number;
  contentData?: {
    title: string;
    summary?: string;
    image_url?: string;
    tags?: string[];
  };
}

const AdminManualIngest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    url: '',
    sourceLabel: '',
    notes: ''
  });
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>({ status: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateUrl = (url: string): string | null => {
    if (!url.trim()) return "URL è richiesto";
    if (url.length > 2048) return "URL troppo lungo (max 2048 caratteri)";
    if (url.startsWith('data:')) return "URLs data: non sono supportati";
    
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return "Solo URLs HTTPS sono supportati";
      return null;
    } catch {
      return "URL non valido";
    }
  };

  const normalizeUrl = (url: string): string => {
    try {
      const parsed = new URL(url.trim());
      // Remove common UTM parameters
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
        parsed.searchParams.delete(param);
      });
      // Remove trailing slash for non-root paths
      if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const pollIngestStatus = async (queueId: number) => {
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max
    
    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('ingestion_queue')
          .select('status, error, url')
          .eq('id', queueId)
          .single();

        if (error) throw error;

        attempts++;
        
        if (data.status === 'done') {
          // Look for the created content
          const normalizedUrl = normalizeUrl(formData.url);
          const { data: content } = await supabase
            .from('drops')
            .select('id, title, summary, image_url, tags')
            .eq('url', normalizedUrl)
            .single();

          setIngestStatus({
            status: 'success',
            message: 'Articolo ingested con successo!',
            contentId: content?.id,
            contentData: content || undefined
          });
          
          toast({
            title: "Successo!",
            description: "L'articolo è stato aggiunto al sistema",
          });
          return;
        }
        
        if (data.status === 'error') {
          setIngestStatus({
            status: 'error',
            message: data.error || 'Errore durante il processing'
          });
          return;
        }
        
        if (attempts >= maxAttempts) {
          setIngestStatus({
            status: 'error',
            message: 'Timeout: processing ha impiegato troppo tempo'
          });
          return;
        }
        
        // Continue polling
        setTimeout(poll, 3000);
      } catch (error) {
        console.error('Polling error:', error);
        setIngestStatus({
          status: 'error',
          message: 'Errore durante il controllo dello status'
        });
      }
    };

    poll();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const urlError = validateUrl(formData.url);
    if (urlError) {
      toast({
        title: "URL non valido",
        description: urlError,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    setIngestStatus({ status: 'validating', message: 'Validating URL...' });

    try {
      const normalizedUrl = normalizeUrl(formData.url);
      
      // Check for existing content first
      setIngestStatus({ status: 'validating', message: 'Controllo duplicati...' });
      
      const { data: existing } = await supabase
        .from('drops')
        .select('id, title, created_at')
        .eq('url', normalizedUrl)
        .single();

      if (existing) {
        setIngestStatus({
          status: 'exists',
          message: 'Questo URL è già stato ingested',
          contentId: existing.id,
          contentData: { title: existing.title }
        });
        setIsSubmitting(false);
        return;
      }

      // Call manual ingest function
      setIngestStatus({ status: 'queuing', message: 'Aggiungendo alla queue...' });
      
      const { data: result, error } = await supabase.functions.invoke('admin-manual-ingest', {
        body: {
          url: normalizedUrl,
          source_label: formData.sourceLabel || null,
          notes: formData.notes || null
        }
      });

      if (error) throw error;

      if (result.status === 'exists') {
        setIngestStatus({
          status: 'exists',
          message: 'URL già esistente nel sistema',
          contentId: result.content_id
        });
      } else if (result.status === 'queued') {
        setIngestStatus({
          status: 'processing',
          message: 'Processing in corso...',
          queueId: result.queue_id
        });
        
        // Start polling
        setTimeout(() => pollIngestStatus(result.queue_id), 2000);
      } else {
        throw new Error(result.error || 'Errore sconosciuto');
      }

    } catch (error) {
      console.error('Manual ingest error:', error);
      setIngestStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Errore durante il processing'
      });
      
      toast({
        title: "Errore",
        description: "Impossibile processare l'URL",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ url: '', sourceLabel: '', notes: '' });
    setIngestStatus({ status: 'idle' });
  };

  const getStatusIcon = () => {
    switch (ingestStatus.status) {
      case 'success':
      case 'exists':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'validating':
      case 'queuing':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (ingestStatus.status) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'exists': return 'bg-blue-50 border-blue-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'validating':
      case 'queuing':
      case 'processing': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <RequireRole minRole="editor">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Manual Ingestion</h1>
            <p className="text-muted-foreground mt-1">
              Aggiungi manualmente un articolo al sistema
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Aggiungi Articolo
              </CardTitle>
              <CardDescription>
                Inserisci l'URL di un articolo da aggiungere al sistema di ingestion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/article"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    required
                    disabled={isSubmitting}
                  />
                  <p className="text-sm text-muted-foreground">
                    Solo URLs HTTPS sono supportati
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sourceLabel">Source Label (opzionale)</Label>
                  <Input
                    id="sourceLabel"
                    placeholder="Nome della fonte"
                    value={formData.sourceLabel}
                    onChange={(e) => setFormData(prev => ({ ...prev, sourceLabel: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Note (opzionale)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Note aggiuntive per questo ingestion..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    disabled={isSubmitting}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !formData.url.trim()}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 mr-2" />
                        Ingest
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleReset}
                    disabled={isSubmitting}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Status Panel */}
          {ingestStatus.status !== 'idle' && (
            <Card className={getStatusColor()}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {getStatusIcon()}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={ingestStatus.status === 'success' ? 'default' : 'secondary'}>
                        {ingestStatus.status === 'validating' && 'Validating'}
                        {ingestStatus.status === 'queuing' && 'Queuing'}
                        {ingestStatus.status === 'processing' && 'Processing'}
                        {ingestStatus.status === 'success' && 'Success'}
                        {ingestStatus.status === 'exists' && 'Already Exists'}
                        {ingestStatus.status === 'error' && 'Error'}
                      </Badge>
                      {ingestStatus.queueId && (
                        <Badge variant="outline">Queue ID: {ingestStatus.queueId}</Badge>
                      )}
                    </div>
                    
                    {ingestStatus.message && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {ingestStatus.message}
                      </p>
                    )}

                    {/* Content Preview */}
                    {ingestStatus.contentData && (
                      <div className="bg-white rounded-lg border p-4">
                        <div className="flex items-start gap-3">
                          {ingestStatus.contentData.image_url && (
                            <img 
                              src={ingestStatus.contentData.image_url} 
                              alt="" 
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm leading-tight mb-1">
                              {ingestStatus.contentData.title}
                            </h4>
                            {ingestStatus.contentData.summary && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {ingestStatus.contentData.summary}
                              </p>
                            )}
                            {ingestStatus.contentData.tags && ingestStatus.contentData.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {ingestStatus.contentData.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {ingestStatus.contentData.tags.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{ingestStatus.contentData.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {ingestStatus.contentId && (
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/feed#article-${ingestStatus.contentId}`} target="_blank" rel="noopener">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Visualizza Articolo
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RequireRole>
  );
};

export default AdminManualIngest;