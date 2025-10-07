import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, RefreshCw } from "lucide-react";

export function YouTubeCommentTestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const { toast } = useToast();

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      // Load jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('social_comment_jobs')
        .select('*')
        .eq('utm_campaign', 'test-20251007')
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Load events for these jobs
      const jobIds = jobsData?.map(j => j.id) || [];
      if (jobIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('social_comment_events')
          .select('*')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false });

        if (eventsError) throw eventsError;
        setEvents(eventsData || []);
      }
    } catch (error: any) {
      toast({
        title: "Errore nel caricamento dati",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const runTest = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-auto-comment', {
        body: { test: true }
      });

      if (error) throw error;

      toast({
        title: "Test completato",
        description: `Funzione eseguita con successo`,
      });

      // Reload data after 2 seconds
      setTimeout(loadData, 2000);
    } catch (error: any) {
      toast({
        title: "Errore nell'esecuzione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>YouTube Auto-Comment Test</CardTitle>
          <CardDescription>
            Test della funzione di auto-commento su 10 video YouTube
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runTest} 
              disabled={isRunning}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Esecuzione in corso...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Esegui Test
                </>
              )}
            </Button>
            <Button 
              onClick={loadData} 
              disabled={isRefreshing}
              variant="outline"
              className="gap-2"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Aggiorna Dati
                </>
              )}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Jobs ({jobs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {jobs.map((job) => (
                    <div key={job.id} className="p-3 border rounded-lg text-sm">
                      <div className="font-medium truncate">{job.video_title}</div>
                      <div className="text-muted-foreground text-xs mt-1">
                        Status: <span className="font-semibold">{job.status}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Topic: {job.topic_slug} | Tries: {job.tries}
                      </div>
                      {job.text_original && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          {job.text_original}
                        </div>
                      )}
                      {job.last_error && (
                        <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-xs">
                          Error: {job.last_error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Events ({events.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.map((event) => (
                    <div key={event.id} className="p-3 border rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          event.status === 'success' ? 'bg-green-500/10 text-green-700' :
                          event.status === 'error' ? 'bg-red-500/10 text-red-700' :
                          'bg-blue-500/10 text-blue-700'
                        }`}>
                          {event.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{event.phase}</span>
                      </div>
                      {event.message && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {event.message}
                        </div>
                      )}
                      {event.data && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                          {JSON.stringify(event.data, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
