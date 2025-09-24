import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

export const CacheRegenerationTrigger = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerateEmptyCaches = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke(
        'admin-regenerate-empty-caches',
        {
          body: {}
        }
      );

      if (funcError) {
        throw funcError;
      }

      setResult(data);
    } catch (err) {
      console.error('Cache regeneration error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Cache Regeneration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Regenerate caches for users with empty or insufficient cache entries.
        </p>
        
        <Button 
          onClick={handleRegenerateEmptyCaches}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Regenerating Caches...
            </>
          ) : (
            'Regenerate Empty Caches'
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 text-green-600 bg-green-50 p-3 rounded-md">
            <CheckCircle className="w-4 h-4 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Cache regeneration completed!</p>
              <pre className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};