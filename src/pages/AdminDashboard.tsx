import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Play, 
  Pause,
  Database,
  Rss,
  Tags,
  Activity,
  Settings,
  Zap,
  Youtube,
  FileText,
  Loader2,
  MonitorSpeaker,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { requireSession } from "@/lib/auth";
import { SitemapTestPanel } from "@/components/SitemapTestPanel";

interface IngestionLog {
  id: number;
  cycle_timestamp: string;
  feeds_processed: number;
  new_articles: number;
  ingestion_processed: number;
  articles_tagged: number;
  errors: string[];
  success: boolean;
  created_at: string;
}

interface CronJob {
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_drops: number;
  tagged_drops: number;
  recent_drops: number;
  processing_queue: number;
}

interface IngestionHealth {
  last_successful_run: string;
  minutes_since_last_run: number;
  is_healthy: boolean;
  queue_size: number;
  untagged_articles: number;
}

interface CronExecution {
  id: number;
  job_name: string;
  executed_at: string;
  success: boolean;
  response_status: number;
  response_body: string;
  error_message: string;
}

interface OnboardingStats {
  pending_users: number;
  reminders_sent_today: number;
  total_reminders_sent: number;
  completion_rate: number;
}

const AdminDashboard = () => {
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ingestionHealth, setIngestionHealth] = useState<IngestionHealth | null>(null);
  const [cronExecutions, setCronExecutions] = useState<CronExecution[]>([]);
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [debugResults, setDebugResults] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkAccess = async () => {
    try {
      await requireSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
        toast({
          title: "Access Denied",
          description: "You need admin privileges to access this page.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Access check failed:', error);
      toast({
        title: "Authentication Error",
        description: "Please login as an admin to access this page.",
        variant: "destructive",
      });
    }
  };

  const fetchData = async () => {
    try {
      // Fetch ingestion logs
      const { data: logsData } = await supabase
        .from('ingestion_logs')
        .select('*')
        .order('cycle_timestamp', { ascending: false })
        .limit(20);

      // Fetch cron jobs
      const { data: cronData } = await supabase
        .from('cron_jobs')
        .select('*')
        .order('name');

      // Fetch ingestion health
      const { data: healthData } = await supabase
        .rpc('get_ingestion_health');

      // Fetch recent cron executions
      const { data: cronExecutionsData } = await supabase
        .from('cron_execution_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(10);

      // Fetch onboarding stats
      const [pendingUsersRes, remindersToday, totalReminders, completedUsers] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', false).eq('is_active', true),
        supabase.from('delivery_log').select('*', { count: 'exact', head: true }).eq('channel', 'email').contains('meta', { reminder_type: 'onboarding' }).gte('sent_at', new Date().toISOString().split('T')[0]),
        supabase.from('delivery_log').select('*', { count: 'exact', head: true }).eq('channel', 'email').contains('meta', { reminder_type: 'onboarding' }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true)
      ]);

      const totalUsers = (pendingUsersRes.count || 0) + (completedUsers.count || 0);
      const completionRate = totalUsers > 0 ? ((completedUsers.count || 0) / totalUsers) * 100 : 0;

      // Update state with fetched data
      setLogs(logsData || []);
      setCronJobs(cronData || []);
      setIngestionHealth(healthData?.[0] || null);
      setCronExecutions(cronExecutionsData || []);
      setOnboardingStats({
        pending_users: pendingUsersRes.count || 0,
        reminders_sent_today: remindersToday.count || 0,
        total_reminders_sent: totalReminders.count || 0,
        completion_rate: Math.round(completionRate)
      });

      // Fetch stats with correct queries
      const [totalDropsRes, taggedDropsRes, queueRes] = await Promise.all([
        supabase.from('drops').select('*', { count: 'exact', head: true }),
        supabase.from('drops').select('*', { count: 'exact', head: true }).eq('tag_done', true),
        supabase.from('ingestion_queue').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing'])
      ]);

      setStats({
        total_drops: totalDropsRes.count || 0,
        tagged_drops: taggedDropsRes.count || 0,
        recent_drops: logsData?.[0]?.new_articles || 0,
        processing_queue: queueRes.count || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCronJob = async (name: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('cron_jobs')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('name', name);

      if (error) throw error;

      setCronJobs(prev => prev.map(job => 
        job.name === name ? { ...job, enabled } : job
      ));

      toast({
        title: enabled ? "Cron Job Enabled" : "Cron Job Disabled",
        description: `${name} has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error toggling cron job:', error);
      toast({
        title: "Error",
        description: "Failed to update cron job status.",
        variant: "destructive",
      });
    }
  };

  const triggerManualRun = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('automated-ingestion', {
        body: { trigger: 'manual_admin' }
      });

      if (error) throw error;

      toast({
        title: "Manual Run Started",
        description: "The ingestion process has been triggered manually.",
      });

      // Refresh data after a delay
      setTimeout(fetchData, 5000);
    } catch (error) {
      console.error('Error triggering manual run:', error);
      toast({
        title: "Error",
        description: "Failed to start manual ingestion.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const triggerRetagAll = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('retag-all-drops', {});

      if (error) throw error;

      toast({
        title: "Retroactive Tagging Started",
        description: `Processing ${data.totalProcessed || 0} articles. ${data.totalErrors || 0} errors.`,
      });

      // Refresh data after completion
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Error triggering retag-all:', error);
      toast({
        title: "Error",
        description: "Failed to start retroactive tagging.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const testYouTubeIntegration = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-youtube-integration', {});

      if (error) throw error;

      const success = data?.tests?.youtubeMetadataFunction?.success && data?.tests?.directYouTubeApi?.success;

      toast({
        title: success ? "YouTube API Test Successful" : "YouTube API Test Failed",
        description: success 
          ? "YouTube API is working correctly. Ready to reprocess videos." 
          : `API Key: ${data?.tests?.apiKeyConfigured ? 'OK' : 'Missing'}, Direct API: ${data?.tests?.directYouTubeApi?.success ? 'OK' : 'Failed'}`,
        variant: success ? "default" : "destructive",
      });

      console.log('YouTube test results:', data);
    } catch (error) {
      console.error('Error testing YouTube integration:', error);
      toast({
        title: "Error",
        description: "Failed to test YouTube integration.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const startYouTubeReprocessing = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-youtube-reprocessing', {});

      if (error) throw error;

      toast({
        title: "YouTube Reprocessing Started",
        description: `Found ${data.totalProblematic || 0} videos to fix. Processing in ${data.batchesNeeded || 0} batches.`,
      });

      console.log('YouTube reprocessing started:', data);

      // Refresh data after a delay
      setTimeout(fetchData, 10000);
    } catch (error) {
      console.error('Error starting YouTube reprocessing:', error);
      toast({
        title: "Error", 
        description: "Failed to start YouTube reprocessing.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const cleanupFailedQueue = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-failed-queue', {});

      if (error) throw error;

      toast({
        title: "Queue Cleanup Complete",
        description: `Cleaned ${data.cleaned || 0} problematic queue items. Ingestion should resume normally.`,
      });

      console.log('Queue cleanup results:', data);

      // Refresh data after cleanup
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Error cleaning up queue:', error);
      toast({
        title: "Error",
        description: "Failed to cleanup queue.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  // Debug functions from AdminDebug
  const triggerDebugFunction = async (functionName: string, payload: any = {}) => {
    setDebugLoading(functionName);
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
        setDebugResults({ error: error.message, function: functionName });
      } else {
        console.log(`✅ ${functionName} success:`, data);
        toast({
          title: "Success",
          description: `${functionName} completed successfully`
        });
        setDebugResults({ data, function: functionName });
      }
      
      // Refresh data after debug action
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      console.error(`❌ ${functionName} exception:`, err);
      toast({
        variant: "destructive", 
        title: "Error",
        description: `${functionName} failed: ${err.message}`
      });
      setDebugResults({ error: err.message, function: functionName });
    } finally {
      setDebugLoading(null);
    }
  };

  const triggerBackgroundRanking = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('background-feed-ranking', {
        body: { trigger: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "Background Ranking Started",
        description: "Feed ranking algorithm has been triggered manually.",
      });
    } catch (error) {
      console.error('Error triggering background ranking:', error);
      toast({
        title: "Error",
        description: "Failed to trigger background ranking.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const triggerSitemapGeneration = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sitemap', {});

      if (error) throw error;

      toast({
        title: "Sitemap Generation Started",
        description: `Generated ${data.totalUrls || 0} URLs in sitemap.`,
      });
    } catch (error) {
      console.error('Error generating sitemap:', error);
      toast({
        title: "Error",
        description: "Failed to generate sitemap.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const sendOnboardingReminders = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-onboarding-reminders', {
        body: { trigger: 'manual_admin' }
      });

      if (error) throw error;

      toast({
        title: "Onboarding Reminders Sent",
        description: `Processed ${data.total_eligible || 0} users: ${data.sent || 0} sent, ${data.errors || 0} errors`,
      });

      // Refresh data after sending
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Error sending onboarding reminders:', error);
      toast({
        title: "Error",
        description: "Failed to send onboarding reminders.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const forceOnboardingReminders = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-onboarding-reminders-force', {
        body: { skipTimingChecks: true, maxAttempts: 15 }
      });

      if (error) throw error;

      toast({
        title: "Force Onboarding Reminders Sent",
        description: `FORCE processed ${data.total_eligible || 0} users: ${data.sent || 0} sent, ${data.errors || 0} errors`,
      });

      // Refresh data after sending
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error('Error force sending onboarding reminders:', error);
      toast({
        title: "Error",
        description: "Failed to force send onboarding reminders.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('it-IT');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <div className="text-muted-foreground">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Unified system monitoring, management and debug console</p>
      </div>

      {/* Global System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_drops || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.tagged_drops || 0} tagged ({Math.round(((stats?.tagged_drops || 0) / (stats?.total_drops || 1)) * 100)}%)
            </p>
            <Progress 
              value={((stats?.tagged_drops || 0) / (stats?.total_drops || 1)) * 100} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processing_queue || 0}</div>
            <p className="text-xs text-muted-foreground">Articles waiting to be processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs[0]?.new_articles || 0}</div>
            <p className="text-xs text-muted-foreground">
              Articles in last cycle ({formatDate(logs[0]?.cycle_timestamp || '')})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {ingestionHealth?.is_healthy ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`font-medium ${ingestionHealth?.is_healthy ? 'text-green-700' : 'text-red-700'}`}>
                {ingestionHealth?.is_healthy ? 'Healthy' : 'Issues Detected'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last run: {ingestionHealth ? `${ingestionHealth.minutes_since_last_run}m ago` : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ingestion Health Monitor */}
      {ingestionHealth && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{ingestionHealth.minutes_since_last_run}m</div>
                <div className="text-sm text-muted-foreground">Since Last Success</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{ingestionHealth.queue_size}</div>
                <div className="text-sm text-muted-foreground">Queue Size</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{ingestionHealth.untagged_articles}</div>
                <div className="text-sm text-muted-foreground">Untagged Articles</div>
              </div>
              <div className="text-center">
                <Badge variant={ingestionHealth.is_healthy ? "default" : "destructive"} className="text-sm">
                  {ingestionHealth.is_healthy ? "HEALTHY" : "UNHEALTHY"}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">Overall Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="control" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="control">Control Panel</TabsTrigger>
          <TabsTrigger value="debug">Debug Console</TabsTrigger>
          <TabsTrigger value="content">Content & Tagging</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="onboarding">User Onboarding</TabsTrigger>
          <TabsTrigger value="system">System Tools</TabsTrigger>
          <TabsTrigger value="sitemaps">Sitemaps & SEO</TabsTrigger>
          <TabsTrigger value="logs">Logs & History</TabsTrigger>
        </TabsList>

        {/* Control Panel */}
        <TabsContent value="control">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Scheduled Jobs Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cronJobs.map((job) => (
                  <div key={job.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium capitalize">{job.name.replace(/_/g, ' ')}</h3>
                      <p className="text-sm text-muted-foreground">
                        Updated: {formatDate(job.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={job.enabled ? "default" : "secondary"}>
                        {job.enabled ? "Active" : "Paused"}
                      </Badge>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(enabled) => toggleCronJob(job.name, enabled)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Manual Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={triggerManualRun} 
                  disabled={running}
                  className="w-full"
                  variant="outline"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {running ? 'Running...' : 'Trigger Manual Ingestion'}
                </Button>
                
                <Button 
                  onClick={triggerRetagAll} 
                  disabled={running}
                  className="w-full"
                  variant="secondary"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Tags className="h-4 w-4 mr-2" />
                  )}
                  {running ? 'Processing...' : 'Retag All Untagged Articles'}
                </Button>
                
                <Button 
                  onClick={cleanupFailedQueue} 
                  disabled={running}
                  className="w-full"
                  variant="destructive"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-2" />
                  )}
                  {running ? 'Cleaning...' : 'Cleanup Failed Queue'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Debug Console */}
        <TabsContent value="debug">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Emergency Debug Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => triggerDebugFunction('trigger-manual-restart')}
                  disabled={debugLoading === 'trigger-manual-restart'}
                  className="w-full"
                  variant="destructive"
                >
                  {debugLoading === 'trigger-manual-restart' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Zap className="w-4 h-4 mr-2" />
                  Emergency System Restart
                </Button>

                <Button 
                  onClick={() => triggerDebugFunction('test-tag-drops')}
                  disabled={debugLoading === 'test-tag-drops'}
                  variant="outline"
                  className="w-full"
                >
                  {debugLoading === 'test-tag-drops' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Tags className="w-4 h-4 mr-2" />
                  Test AI Tagging System
                </Button>

                <Button 
                  onClick={() => triggerDebugFunction('tag-drops', { limit: 20, concurrent_requests: 2 })}
                  disabled={debugLoading === 'tag-drops'}
                  variant="outline"
                  className="w-full"
                >
                  {debugLoading === 'tag-drops' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Play className="w-4 h-4 mr-2" />
                  Force Process Untagged (20)
                </Button>
              </CardContent>
            </Card>

            {debugResults && (
              <Card>
                <CardHeader>
                  <CardTitle>Debug Results - {debugResults.function}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                    {JSON.stringify(debugResults, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Content & Tagging */}
        <TabsContent value="content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Content Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{(stats?.total_drops || 0) - (stats?.tagged_drops || 0)}</div>
                    <div className="text-sm text-muted-foreground">Untagged Articles</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{Math.round(((stats?.tagged_drops || 0) / (stats?.total_drops || 1)) * 100)}%</div>
                    <div className="text-sm text-muted-foreground">Completion Rate</div>
                  </div>
                </div>
                
                <Separator />
                
                <Button 
                  onClick={() => triggerDebugFunction('admin-manual-ingest')}
                  disabled={debugLoading === 'admin-manual-ingest'}
                  variant="outline"
                  className="w-full"
                >
                  {debugLoading === 'admin-manual-ingest' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <FileText className="w-4 h-4 mr-2" />
                  Manual Article Ingest
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorSpeaker className="h-5 w-5" />
                  Tagging Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Success Rate</span>
                    <Badge variant="default">{Math.round(((stats?.tagged_drops || 0) / (stats?.total_drops || 1)) * 100)}%</Badge>
                  </div>
                  <Progress value={((stats?.tagged_drops || 0) / (stats?.total_drops || 1)) * 100} />
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>• Total Articles: {stats?.total_drops || 0}</div>
                    <div>• Successfully Tagged: {stats?.tagged_drops || 0}</div>
                    <div>• Pending: {(stats?.total_drops || 0) - (stats?.tagged_drops || 0)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* YouTube */}
        <TabsContent value="youtube">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Youtube className="h-5 w-5" />
                  YouTube Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={testYouTubeIntegration} 
                  disabled={running}
                  className="w-full"
                  variant="outline"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Test YouTube API Connection
                </Button>
                
                <Button 
                  onClick={startYouTubeReprocessing} 
                  disabled={running}
                  className="w-full"
                  variant="destructive"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Youtube className="h-4 w-4 mr-2" />
                  )}
                  Start YouTube Reprocessing
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Reprocess YouTube videos with missing or incorrect metadata
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* User Onboarding */}
        <TabsContent value="onboarding">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Onboarding Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">{onboardingStats?.pending_users || 0}</div>
                    <div className="text-sm text-muted-foreground">Pending Users</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{onboardingStats?.completion_rate || 0}%</div>
                    <div className="text-sm text-muted-foreground">Completion Rate</div>
                  </div>
                </div>

                <Separator />
                
                <Button 
                  onClick={sendOnboardingReminders} 
                  disabled={running}
                  className="w-full"
                  variant="outline"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Send Onboarding Reminders
                </Button>
                
                <Button 
                  onClick={forceOnboardingReminders} 
                  disabled={running}
                  className="w-full"
                  variant="destructive"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Force Send Reminders (Admin)
                </Button>

                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div>• Normal: Respects 24h first, then 30-day intervals</div>
                  <div>• Force: Bypasses timing restrictions for testing</div>
                  <div>• Automated daily execution at 09:00 UTC</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Onboarding Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{onboardingStats?.reminders_sent_today || 0}</div>
                      <div className="text-xs text-muted-foreground">Sent Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{onboardingStats?.total_reminders_sent || 0}</div>
                      <div className="text-xs text-muted-foreground">Total Sent</div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="text-sm text-muted-foreground">
                    <div className="font-medium mb-2">Reminder Schedule:</div>
                    <div className="space-y-1">
                      <div>• 1st reminder: 24 hours after signup</div>
                      <div>• Subsequent: Every 30 days</div>
                      <div>• Max attempts: 10 per user</div>
                      <div>• Daily automated check: 09:00 UTC</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tools */}
        <TabsContent value="system">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  SEO & Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={triggerSitemapGeneration} 
                  disabled={running}
                  className="w-full"
                  variant="outline"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4 mr-2" />
                  )}
                  Generate Sitemap
                </Button>
                
                <Button 
                  onClick={triggerBackgroundRanking} 
                  disabled={running}
                  className="w-full"
                  variant="secondary"
                >
                  {running ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Trigger Feed Ranking
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sitemaps & SEO */}
        <TabsContent value="sitemaps">
          <div className="space-y-6">
            <SitemapTestPanel />
          </div>
        </TabsContent>

        {/* Logs & History */}
        <TabsContent value="logs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ingestion Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rss className="h-5 w-5" />
                  Recent Ingestion Cycles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className={`p-3 border rounded-lg ${log.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {formatDate(log.cycle_timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Rss className="h-3 w-3" />
                          <span>Feeds: {log.feeds_processed}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          <span>New: {log.new_articles}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          <span>Processed: {log.ingestion_processed}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Tags className="h-3 w-3" />
                          <span>Tagged: {log.articles_tagged}</span>
                        </div>
                      </div>
                      
                      {log.errors && log.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs">
                          <span className="font-medium text-red-700 dark:text-red-400">Errors:</span>
                          <ul className="list-disc list-inside mt-1 text-red-600 dark:text-red-300">
                            {log.errors.slice(0, 2).map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                            {log.errors.length > 2 && (
                              <li>+{log.errors.length - 2} more errors...</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {logs.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>No ingestion logs yet</p>
                      <p className="text-xs">Logs will appear after the first automated cycle</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cron Execution History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Cron Execution History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cronExecutions.map((execution) => (
                    <div key={execution.id} className={`p-3 border rounded-lg ${execution.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {execution.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {formatDate(execution.executed_at)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {execution.job_name}
                          </Badge>
                        </div>
                        <Badge variant={execution.success ? "default" : "destructive"} className="text-xs">
                          {execution.response_status || (execution.success ? 'Success' : 'Failed')}
                        </Badge>
                      </div>
                      
                      {execution.error_message && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded text-xs">
                          <strong>Error:</strong> {execution.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {cronExecutions.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>No cron executions yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;