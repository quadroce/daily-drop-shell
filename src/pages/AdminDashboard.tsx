import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { requireSession } from "@/lib/auth";

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

const AdminDashboard = () => {
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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
        <p className="text-muted-foreground">Monitor automated content ingestion and system status</p>
      </div>

      {/* Stats Cards */}
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
              {logs[0]?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`font-medium ${logs[0]?.success ? 'text-green-700' : 'text-red-700'}`}>
                {logs[0]?.success ? 'Healthy' : 'Issues Detected'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last check: {formatDate(logs[0]?.created_at || '')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cron Jobs Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduled Jobs
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
            
            <Separator />
            
            <div className="space-y-2">
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
                {running ? 'Running...' : 'Trigger Manual Run'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Force a manual content ingestion cycle
              </p>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
};

export default AdminDashboard;