import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export function CacheRegenerationAdmin() {
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const regenerateAllCaches = async () => {
    try {
      setIsRegenerating(true);
      setResults(null);
      
      console.log('🔄 Starting cache regeneration for all users...');
      
      const { data, error } = await supabase.functions.invoke('regenerate-all-caches');
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Cache regeneration completed:', data);
      setResults(data.results);
      
      toast({
        title: "Cache Regeneration Complete",
        description: `Processed ${data.results?.processed || 0} users`,
      });
      
    } catch (error) {
      console.error('❌ Error regenerating caches:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate caches",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Cache Regeneration
        </CardTitle>
        <CardDescription>
          Regenerate personalized feed caches for all active users. This will clear existing caches and rebuild them using the latest ranking algorithm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={regenerateAllCaches}
          disabled={isRegenerating}
          className="w-full"
        >
          {isRegenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Regenerating Caches...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate All User Caches
            </>
          )}
        </Button>
        
        {results && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Results:</h4>
            <ul className="text-sm space-y-1">
              <li>Total Users: {results.total_users}</li>
              <li>Processed: {results.processed}</li>
              <li>Errors: {results.errors?.length || 0}</li>
            </ul>
            
            {results.errors && results.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">View Errors</summary>
                <div className="mt-2 text-xs space-y-1 text-destructive">
                  {results.errors.map((error: string, index: number) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}