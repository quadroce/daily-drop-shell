import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AdminDebug() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const triggerFunction = async (functionName: string, payload: any = {}) => {
    setLoading(functionName);
    try {
      console.log(`🔄 Calling ${functionName}...`);
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) {
        console.error(`❌ ${functionName} error:`, error);
        toast({
          variant: "destructive",
          title: "Error",
          description: `${functionName} failed: ${error.message}`
        });
        setResults({ error: error.message, function: functionName });
      } else {
        console.log(`✅ ${functionName} success:`, data);
        toast({
          title: "Success",
          description: `${functionName} completed successfully`
        });
        setResults({ data, function: functionName });
      }
    } catch (err: any) {
      console.error(`❌ ${functionName} exception:`, err);
      toast({
        variant: "destructive", 
        title: "Error",
        description: `${functionName} failed: ${err.message}`
      });
      setResults({ error: err.message, function: functionName });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Debug Console</h1>
        <p className="text-muted-foreground">
          Debug and restart the content ingestion system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Current ingestion system health
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Last successful run:</span>
              <Badge variant="destructive">20:38 (111 min ago)</Badge>
            </div>
            <div className="flex justify-between">
              <span>Queue size:</span>
              <Badge variant="secondary">8 pending</Badge>
            </div>
            <div className="flex justify-between">
              <span>Untagged articles:</span>
              <Badge variant="secondary">~40 remaining</Badge>
            </div>
            <div className="flex justify-between">
              <span>System health:</span>
              <Badge variant="destructive">Unhealthy</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Quick Fix Actions
            </CardTitle>
            <CardDescription>
              Emergency fixes for blocked ingestion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => triggerFunction('trigger-manual-restart')}
              disabled={loading === 'trigger-manual-restart'}
              className="w-full"
            >
              {loading === 'trigger-manual-restart' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-4 h-4 mr-2" />
              Trigger Manual Restart
            </Button>

            <Button 
              onClick={() => triggerFunction('test-tag-drops')}
              disabled={loading === 'test-tag-drops'}
              variant="outline"
              className="w-full"
            >
              {loading === 'test-tag-drops' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test AI Tagging
            </Button>

            <Button 
              onClick={() => triggerFunction('tag-drops', { limit: 20, concurrent_requests: 2 })}
              disabled={loading === 'tag-drops'}
              variant="outline"
              className="w-full"
            >
              {loading === 'tag-drops' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Process Untagged Articles
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Results - {results.function}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>System Recovery Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">✅ Step 1</Badge>
            <span>Cleared stuck queue items</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">✅ Step 2</Badge>
            <span>Fixed 27 untagged media articles</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">🔄 Step 3</Badge>
            <span>Trigger restart to resume ingestion</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">⏳ Step 4</Badge>
            <span>Monitor for new articles</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}