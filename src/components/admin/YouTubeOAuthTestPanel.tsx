import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export function YouTubeOAuthTestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const { toast } = useToast();

  const runTest = async () => {
    setIsRunning(true);
    setResult(null);
    setLogs([]);

    try {
      // Invoke the edge function
      console.log('🚀 Invoking youtube-auto-comment function...');
      const { data, error } = await supabase.functions.invoke('youtube-auto-comment', {
        body: { test: true }
      });

      if (error) throw error;

      console.log('✅ Function response:', data);
      setResult(data);

      // Fetch logs for the job
      if (data.jobId) {
        setTimeout(async () => {
          const { data: logsData, error: logsError } = await supabase
            .from('social_comment_events')
            .select('*')
            .eq('job_id', data.jobId)
            .order('created_at', { ascending: false });

          if (!logsError && logsData) {
            setLogs(logsData);
          }
        }, 1000);
      }

      // Show appropriate toast
      if (data.status === 'posted') {
        toast({
          title: "✅ Comment Posted!",
          description: `Successfully posted comment to video ${data.videoId}`,
        });
      } else if (data.status === 'ready') {
        toast({
          title: "⚠️ OAuth Not Configured",
          description: "Comment generated but not posted. Check YOUTUBE_OAUTH_TOKEN secret.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Test error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to run test",
        variant: "destructive",
      });
      setResult({ error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'posted':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'ready':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube OAuth Test</CardTitle>
        <CardDescription>
          Test YouTube API integration with a single comment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTest} 
          disabled={isRunning}
          className="w-full gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run YouTube OAuth Test
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
              {getStatusIcon(result.status)}
              <div className="flex-1">
                <div className="font-medium">
                  {result.status === 'posted' ? 'Comment Posted Successfully!' :
                   result.status === 'ready' ? 'Comment Ready (OAuth Missing)' :
                   result.error ? 'Error Occurred' : 'Unknown Status'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {result.videoId && `Video: ${result.videoId}`}
                  {result.commentId && ` | Comment ID: ${result.commentId}`}
                  {result.error && ` | Error: ${result.error}`}
                </div>
              </div>
            </div>

            {result.status === 'posted' && result.commentId && (
              <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <div className="font-medium text-green-900 dark:text-green-100 mb-2">
                  🎉 Success! Comment is live on YouTube
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Comment ID: <code className="px-2 py-1 bg-green-100 dark:bg-green-900 rounded">{result.commentId}</code>
                </div>
                <a 
                  href={`https://www.youtube.com/watch?v=${result.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 dark:text-green-300 hover:underline mt-2 inline-block"
                >
                  View on YouTube →
                </a>
              </div>
            )}

            {result.status === 'ready' && (
              <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
                <div className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                  ⚠️ OAuth Token Not Configured
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                  The comment was generated but not posted because YOUTUBE_OAUTH_TOKEN is missing.
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  Follow the setup guide in <code>docs/youtube-oauth-setup.md</code>
                </div>
              </div>
            )}

            {result.error && (
              <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                <div className="font-medium text-red-900 dark:text-red-100 mb-2">
                  ❌ Error
                </div>
                <div className="text-sm text-red-700 dark:text-red-300 font-mono">
                  {result.error}
                </div>
              </div>
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Event Logs</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="text-xs p-2 rounded border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      log.status === 'success' ? 'bg-green-500/10 text-green-700' :
                      log.status === 'error' ? 'bg-red-500/10 text-red-700' :
                      log.status === 'warning' ? 'bg-yellow-500/10 text-yellow-700' :
                      'bg-blue-500/10 text-blue-700'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-muted-foreground">{log.phase}</span>
                  </div>
                  <div className="mt-1">{log.message}</div>
                  {log.data && (
                    <pre className="mt-1 text-[10px] text-muted-foreground overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded">
          <strong>Note:</strong> This will attempt to post a comment to a test video (Rick Astley).
          Make sure YOUTUBE_OAUTH_TOKEN is configured in Supabase secrets.
        </div>
      </CardContent>
    </Card>
  );
}
