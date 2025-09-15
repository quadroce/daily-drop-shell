import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, ExternalLink, CheckCircle, XCircle, Globe } from 'lucide-react';

interface SitemapRun {
  id: number;
  started_at: string;
  completed_at: string | null;
  success: boolean;
  error_message: string | null;
  total_urls: number;
  topics_count: number;
  archive_urls_count: number;
  google_ping_success: boolean;
  bing_ping_success: boolean;
}

interface SitemapTestResult {
  url: string;
  status: 'success' | 'error';
  httpStatus?: number;
  contentType?: string;
  isValidXml?: boolean;
  urlCount?: number;
  error?: string;
  responseTime?: number;
}

export const SitemapPage = () => {
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<SitemapRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [testingConnectivity, setTestingConnectivity] = useState(false);
  const [testResults, setTestResults] = useState<SitemapTestResult[]>([]);
  const { toast } = useToast();

  const loadRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('sitemap_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRuns(data || []);
    } catch (error) {
      console.error('Error loading sitemap runs:', error);
      toast({
        title: "Error",
        description: "Failed to load sitemap generation history",
        variant: "destructive"
      });
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const generateSitemap = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-sitemap-generation');

      if (error) throw error;

      toast({
        title: "Success", 
        description: "Sitemap generation started via GitHub Actions"
      });

      // Start polling for updates
      const pollForUpdates = () => {
        setTimeout(async () => {
          await loadRuns();
          // Continue polling if there are in-progress runs
          const hasInProgress = runs.some(run => !run.completed_at);
          if (hasInProgress) {
            pollForUpdates();
          }
        }, 5000);
      };
      
      pollForUpdates();

    } catch (error) {
      console.error('Error generating sitemap:', error);
      toast({
        title: "Error",
        description: "Failed to start sitemap generation",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testSitemapConnectivity = async () => {
    setTestingConnectivity(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-sitemap-connectivity');

      if (error) throw error;

      setTestResults(data.results || []);
      
      const successCount = data.summary.successCount;
      const totalCount = data.summary.totalEndpoints;
      
      toast({
        title: successCount === totalCount ? "All Tests Passed" : "Some Tests Failed",
        description: `${successCount}/${totalCount} endpoints accessible with ${data.summary.totalUrls} total URLs`,
        variant: successCount === totalCount ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Error testing sitemap connectivity:', error);
      toast({
        title: "Test Failed",
        description: "Unable to test sitemap connectivity",
        variant: "destructive"
      });
    } finally {
      setTestingConnectivity(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sitemap Management</h1>
          <p className="text-muted-foreground">
            Manage and monitor sitemap generation for SEO optimization
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={testSitemapConnectivity} 
            disabled={testingConnectivity}
            variant="outline"
            className="flex items-center gap-2"
          >
            {testingConnectivity ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            Test Connectivity
          </Button>
          <Button 
            onClick={generateSitemap} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate Sitemap
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sitemap Index</CardTitle>
            <CardDescription>Main sitemap entry point</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href="/sitemap.xml" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              /sitemap.xml
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Static Pages</CardTitle>
            <CardDescription>Core site pages</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href="/sitemap-proxy/sitemaps/core.xml" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              /sitemap-proxy/sitemaps/core.xml
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Topics</CardTitle>
            <CardDescription>All topic pages</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href="/sitemap-proxy/sitemaps/topics.xml" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              /sitemap-proxy/sitemaps/topics.xml
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Archives</CardTitle>
            <CardDescription>Daily archive pages</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href="/sitemap-proxy/sitemaps/topics-archive.xml" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              /sitemap-proxy/sitemaps/topics-archive.xml
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      </div>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Connectivity Test Results
            </CardTitle>
            <CardDescription>
              Real-time test of all sitemap endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{result.url.replace('https://dailydrops.cloud', '')}</div>
                      {result.error && (
                        <div className="text-xs text-red-600">{result.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {result.httpStatus && (
                      <Badge variant={result.httpStatus === 200 ? "default" : "destructive"}>
                        {result.httpStatus}
                      </Badge>
                    )}
                    {result.urlCount !== undefined && (
                      <span>{result.urlCount} URLs</span>
                    )}
                    {result.responseTime && (
                      <span>{result.responseTime}ms</span>
                    )}
                    {result.isValidXml !== undefined && (
                      <Badge variant={result.isValidXml ? "default" : "secondary"}>
                        {result.isValidXml ? "Valid XML" : "Invalid XML"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Generation History</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadRuns}
              disabled={loadingRuns}
            >
              {loadingRuns ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <CardDescription>
            Recent sitemap generation runs and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRuns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sitemap generation history found
            </p>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <div key={run.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={run.success ? "default" : "destructive"}>
                        {run.success ? "Success" : "Failed"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(run.started_at).toLocaleString()}
                      </span>
                    </div>
                    {run.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        Completed: {new Date(run.completed_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  
                  {run.success && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total URLs:</span> {run.total_urls}
                      </div>
                      <div>
                        <span className="font-medium">Topics:</span> {run.topics_count}
                      </div>
                      <div>
                        <span className="font-medium">Archives:</span> {run.archive_urls_count}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Search Engines:</span>
                        <Badge variant={run.google_ping_success ? "default" : "secondary"} className="text-xs">
                          Google
                        </Badge>
                        <Badge variant={run.bing_ping_success ? "default" : "secondary"} className="text-xs">
                          Bing
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  {run.error_message && (
                    <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                      {run.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Status</CardTitle>
          <CardDescription>
            Sitemap generation is automated via GitHub Actions and runs daily at 2:00 UTC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Schedule:</span>
              <Badge variant="outline">Daily at 2:00 UTC</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Google ping:</span>
              <Badge variant="outline">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Bing ping:</span>
              <Badge variant="outline">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Archive window:</span>
              <Badge variant="outline">90 days</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};