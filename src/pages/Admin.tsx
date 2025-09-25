import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VectorSystemInit } from "@/components/VectorSystemInit";
import { NewsletterTestPanel } from "@/components/admin/NewsletterTestPanel";
import { CacheRegenerationTrigger } from "@/components/admin/CacheRegenerationTrigger";
import { ServiceStatusIndicators } from "@/components/admin/ServiceStatusIndicators";
import { Loader2, Users, Database, List, ArrowLeft, Rss, Cog, Tags, Monitor, Map, Globe, Youtube, Settings, Mail } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  role: string;
}

interface DashboardStats {
  sourcesCount: number;
  queueCount: number;
  usersCount: number;
}

interface TaggingStats {
  totalDrops: number;
  taggedDrops: number;
  untaggedDrops: number;
  taggedPercentage: number;
}

interface TopTag {
  tag: string;
  frequency: number;
}

interface CronJob {
  name: string;
  enabled: boolean;
}

interface UISettings {
  show_alpha_ribbon: boolean;
  show_feedback_button: boolean;
}

interface ServiceStatus {
  rss_fetcher: 'active' | 'error' | 'idle';
  ingest_worker: 'active' | 'paused' | 'idle';
  tagger: 'active' | 'paused' | 'idle';
}

const Admin = () => {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    sourcesCount: 0,
    queueCount: 0,
    usersCount: 0,
  });
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [taggingStats, setTaggingStats] = useState<TaggingStats>({
    totalDrops: 0,
    taggedDrops: 0,
    untaggedDrops: 0,
    taggedPercentage: 0,
  });
  const [topTags, setTopTags] = useState<TopTag[]>([]);
  const [uiSettings, setUiSettings] = useState<UISettings>({
    show_alpha_ribbon: true,
    show_feedback_button: true,
  });
  const [systemStatus, setSystemStatus] = useState({
    rssFetcher: 'checking',
    ingestWorker: 'checking', 
    tagger: 'checking'
  });

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      // Check if user has session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        navigate("/auth");
        return;
      }

      // Fetch user profile and role
      try {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("id, email, role")
          .eq("id", currentSession.user.id)
          .single();

        if (error) {
          console.error("Profile fetch error:", error);
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Check if user is admin or superadmin
        const isAdmin = profileData?.role === 'admin' || profileData?.role === 'superadmin';
        setIsAuthorized(isAdmin);
        
        // Fetch dashboard stats if user is authorized
        if (isAdmin) {
          await fetchDashboardStats();
          await fetchCronJobs();
          await fetchTaggingStats();
          await fetchUISettings();
          await fetchSystemStatus();
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Access check error:", error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [authLoading, navigate]);

  const fetchDashboardStats = async () => {
    try {
      // Fetch sources count
      const { count: sourcesCount, error: sourcesError } = await supabase
        .from('sources')
        .select('*', { count: 'exact', head: true });

      if (sourcesError) {
        console.error('Error fetching sources count:', sourcesError);
      }

      // Fetch queue count (pending + processing items)
      const { count: queueCount, error: queueError } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'processing']);

      if (queueError) {
        console.error('Error fetching queue count:', queueError);
      }

      // Fetch users count with better debugging
      console.log('Fetching users count from profiles table...');
      const { count: usersCount, error: usersError, data: usersData } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('Error fetching users count:', usersError);
        toast({
          title: "Error fetching users count",
          description: usersError.message,
          variant: "destructive",
        });
      } else {
        console.log('Users count query result:', { count: usersCount, error: usersError });
        
        // Additional verification query to double-check
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, role, created_at')
          .limit(10);

        console.log('Profiles verification query:', { 
          profiles: profilesData, 
          profilesCount: profilesData?.length || 0, 
          error: profilesError 
        });
      }

      setStats({
        sourcesCount: sourcesCount || 0,
        queueCount: queueCount || 0,
        usersCount: usersCount || 0,
      });

      console.log('Dashboard stats updated:', {
        sourcesCount: sourcesCount || 0,
        queueCount: queueCount || 0,
        usersCount: usersCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: "Error fetching dashboard statistics",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    }
  };

  const fetchCronJobs = async () => {
    try {
      const { data: cronJobsData } = await supabase
        .from('cron_jobs')
        .select('name, enabled');

      setCronJobs(cronJobsData || []);
    } catch (error) {
      console.error('Error fetching cron jobs:', error);
    }
  };

  const fetchTaggingStats = async () => {
    try {
      // Fetch total drops count
      const { count: totalDrops } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true });

      // Fetch tagged drops count
      const { count: taggedDrops } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .eq('tag_done', true);

      const total = totalDrops || 0;
      const tagged = taggedDrops || 0;
      const untaggedDrops = total - tagged;
      const taggedPercentage = total > 0 ? (tagged / total) * 100 : 0;

      setTaggingStats({
        totalDrops: total,
        taggedDrops: tagged,
        untaggedDrops,
        taggedPercentage,
      });

      // Fetch top tags with direct query
      const { data: dropsWithTags, error: tagsError } = await supabase
        .from('drops')
        .select('tags')
        .eq('tag_done', true)
        .not('tags', 'eq', '{}');

      if (tagsError) throw tagsError;

      // Count tag frequencies
      const tagCounts: Record<string, number> = {};
      dropsWithTags?.forEach(drop => {
        drop.tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      // Convert to TopTag array and sort
      const topTagsArray = Object.entries(tagCounts)
        .map(([tag, frequency]) => ({ tag, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 15);

      setTopTags(topTagsArray);
    } catch (error) {
      console.error('Error fetching tagging stats:', error);
    }
  };

  const fetchUISettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['show_alpha_ribbon', 'show_feedback_button']);

      if (data) {
        const settings: UISettings = {
          show_alpha_ribbon: true,
          show_feedback_button: true,
        };

        data.forEach(setting => {
          const value = setting.value as unknown as { enabled: boolean };
          if (setting.key === 'show_alpha_ribbon') {
            settings.show_alpha_ribbon = value?.enabled ?? true;
          } else if (setting.key === 'show_feedback_button') {
            settings.show_feedback_button = value?.enabled ?? true;
          }
        });

        setUiSettings(settings);
      }
    } catch (error) {
      console.error('Error fetching UI settings:', error);
    }
  };

  const updateUISetting = async (key: keyof UISettings, enabled: boolean) => {
    setActionLoading(`ui-${key}`);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key,
          value: { enabled },
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setUiSettings(prev => ({ ...prev, [key]: enabled }));

      toast({
        title: "UI Setting Updated",
        description: `${key.replace('_', ' ')} has been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating UI setting:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update setting',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      // Check RSS Fetcher status by looking at recent executions
      const { data: recentCronLogs } = await supabase
        .from('cron_execution_log')
        .select('success, executed_at, job_name')
        .eq('job_name', 'restart-ingestion')
        .order('executed_at', { ascending: false })
        .limit(1);

      // Check queue errors count
      const { count: errorCount } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error');

      // Check queue pending/processing count
      const { count: activeCount } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'processing']);

      // Check recent successful drops
      const { count: recentDrops } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Determine statuses based on data
      let rssFetcherStatus = 'paused';
      let ingestWorkerStatus = 'paused';
      let taggerStatus = 'paused';

      // RSS Fetcher: Check if recent runs were successful
      if (recentCronLogs && recentCronLogs[0]) {
        const recentExecution = recentCronLogs[0];
        const timeSinceExecution = Date.now() - new Date(recentExecution.executed_at).getTime();
        
        if (timeSinceExecution < 10 * 60 * 1000) { // Last 10 minutes
          rssFetcherStatus = recentExecution.success ? 'active' : 'error';
        } else if (timeSinceExecution < 60 * 60 * 1000) { // Last hour
          rssFetcherStatus = 'idle';
        }
      }

      // Ingest Worker: Active if processing items, error if many errors, idle otherwise
      if (activeCount && activeCount > 0) {
        ingestWorkerStatus = 'active';
      } else if (errorCount && errorCount > 100) {
        ingestWorkerStatus = 'error';
      } else {
        ingestWorkerStatus = 'idle';
      }

      // Tagger: Active if recent drops, idle if some recent activity
      if (recentDrops && recentDrops > 10) {
        taggerStatus = 'active';
      } else if (recentDrops && recentDrops > 0) {
        taggerStatus = 'idle';
      }

      setSystemStatus({
        rssFetcher: rssFetcherStatus,
        ingestWorker: ingestWorkerStatus,
        tagger: taggerStatus
      });

    } catch (error) {
      console.error('Error fetching system status:', error);
      setSystemStatus({
        rssFetcher: 'error',
        ingestWorker: 'error',
        tagger: 'error'
      });
    }
  };

  // Ingestion control handlers
  const fixPipeline = async () => {
    setActionLoading('fix-pipeline');
    try {
      const response = await fetch('https://qimelntuxquptqqynxzv.supabase.co/functions/v1/admin-debug-ingestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear_queue' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      toast({
        title: "Pipeline Fixed",
        description: "Cleared error queue items and reset pipeline status",
      });
      
      // Refresh stats
      await fetchDashboardStats();
      await fetchSystemStatus();
    } catch (error) {
      console.error('Fix pipeline error:', error);
      toast({
        title: "Fix Pipeline Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const restartIngestion = async () => {
    setActionLoading('restart-ingestion');
    try {
      const response = await fetch('https://qimelntuxquptqqynxzv.supabase.co/functions/v1/restart-ingestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'manual' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      toast({
        title: "Ingestion Restarted",
        description: "Full ingestion pipeline restart completed successfully",
      });
      
      // Refresh stats
      await fetchDashboardStats();
      await fetchTaggingStats();
      await fetchSystemStatus();
    } catch (error) {
      console.error('Restart ingestion error:', error);
      toast({
        title: "Restart Ingestion Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Manual testing handlers
  const runRSSFetcher = async () => {
    setActionLoading('rss');
    try {
      const response = await fetch('https://qimelntuxquptqqynxzv.supabase.co/functions/v1/fetch-rss', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        toast({
          title: "RSS Fetcher Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        const sourcesCount = result.sources ?? 0;
        const enqueuedCount = result.enqueued ?? 0;
        
        toast({
          title: "RSS Fetcher Complete",
          description: `Processed ${sourcesCount} sources, enqueued ${enqueuedCount} items`,
        });
      }
    } catch (error) {
      console.error('RSS Fetcher error:', error);
      toast({
        title: "RSS Fetcher Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const runIngestWorker = async () => {
    setActionLoading('ingest');
    try {
      const response = await fetch('https://qimelntuxquptqqynxzv.supabase.co/functions/v1/ingest-queue', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 50 })
      });
      const result = await response.json();
      
      toast({
        title: "Ingest Worker Complete",
        description: `Processed ${result.processed} items, ${result.done} successful, ${result.errors} errors`,
      });
      
      // Refresh stats after processing
      await fetchDashboardStats();
      await fetchSystemStatus();
    } catch (error) {
      console.error('Ingest Worker error:', error);
      toast({
        title: "Ingest Worker Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const runTagger = async () => {
    setActionLoading('tagger');
    try {
      const response = await fetch('https://qimelntuxquptqqynxzv.supabase.co/functions/v1/tag-drops', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Tagger result:', result);
      
      // Handle both success and error responses
      if (result.error) {
        toast({
          title: "Tagger Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        const processed = result.processed ?? 0;
        const tagged = result.tagged ?? 0;
        const errors = result.errors ?? 0;
        
        toast({
          title: "Tagger Complete",
          description: `Processed ${processed} drops, ${tagged} tagged successfully${errors > 0 ? `, ${errors} errors` : ''}`,
        });
        
        // Refresh tagging stats after processing
        await fetchTaggingStats();
        await fetchSystemStatus();
      }
    } catch (error) {
      console.error('Tagger error:', error);
      toast({
        title: "Tagger Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };


  const toggleAutoIngest = async () => {
    setActionLoading('toggle-auto');
    try {
      const currentJob = cronJobs.find(job => job.name === 'auto-ingest-worker');
      const newStatus = !currentJob?.enabled;
      
      // Use upsert to handle both creating and updating the record
      const { error } = await supabase
        .from('cron_jobs')
        .upsert({ 
          name: 'auto-ingest-worker',
          enabled: newStatus, 
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update local state - handle both existing and new records
      setCronJobs(prev => {
        const existingJobIndex = prev.findIndex(job => job.name === 'auto-ingest-worker');
        if (existingJobIndex >= 0) {
          // Update existing record
          return prev.map(job => 
            job.name === 'auto-ingest-worker' 
              ? { ...job, enabled: newStatus }
              : job
          );
        } else {
          // Add new record
          return [...prev, {
            name: 'auto-ingest-worker',
            enabled: newStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }];
        }
      });

      toast({
        title: `Auto Ingest Worker ${newStatus ? 'Enabled' : 'Disabled'}`,
        description: newStatus 
          ? 'The system will now automatically process queue items every 5 minutes' 
          : 'Automatic processing has been disabled',
      });
    } catch (error) {
      console.error('Toggle auto ingest error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to toggle auto ingest',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authorized - show "Admins only" message
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Admins Only</CardTitle>
            <CardDescription>
              You don't have permission to access this area.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/feed")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Feed
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authorized admin view
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your DailyDrops platform
          </p>
        </div>
        
        {/* Profile badge */}
        {profile && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">{profile.email}</span>
            <Badge variant="secondary">{profile.role}</Badge>
          </div>
        )}
      </div>

      {/* 🚨 INGESTION CONTROL PANEL */}
      <Card className="mb-8 border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            🚨 Ingestion Control Panel
          </CardTitle>
          <CardDescription>
            Critical pipeline controls - Articles: {taggingStats.totalDrops} | Queue Errors: {stats.queueCount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={fixPipeline}
              disabled={actionLoading !== null}
              variant="destructive"
              className="flex items-center gap-2 h-12"
            >
              {actionLoading === 'fix-pipeline' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Settings className="h-5 w-5" />
              )}
              Fix Pipeline (Clear {stats.queueCount} Errors)
            </Button>
            
            <Button 
              onClick={restartIngestion}
              disabled={actionLoading !== null}
              variant="default"
              className="flex items-center gap-2 h-12"
            >
              {actionLoading === 'restart-ingestion' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Rss className="h-5 w-5" />
              )}
              Restart Ingestion (Full)
            </Button>
          </div>
          
          {/* Service Status Indicators */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center p-2 bg-muted rounded">
              <div className="text-sm font-medium">RSS Fetcher</div>
              <Badge 
                variant={
                  systemStatus.rssFetcher === 'active' ? 'default' :
                  systemStatus.rssFetcher === 'error' ? 'destructive' :
                  systemStatus.rssFetcher === 'idle' ? 'outline' : 'secondary'
                } 
                className="mt-1"
              >
                {systemStatus.rssFetcher === 'active' ? 'Active' :
                 systemStatus.rssFetcher === 'error' ? 'Error' :
                 systemStatus.rssFetcher === 'idle' ? 'Idle' : 
                 systemStatus.rssFetcher === 'checking' ? 'Checking...' : 'Paused'}
              </Badge>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="text-sm font-medium">Ingest Worker</div>
              <Badge 
                variant={
                  systemStatus.ingestWorker === 'active' ? 'default' :
                  systemStatus.ingestWorker === 'error' ? 'destructive' :
                  systemStatus.ingestWorker === 'idle' ? 'outline' : 'secondary'
                } 
                className="mt-1"
              >
                {systemStatus.ingestWorker === 'active' ? 'Active' :
                 systemStatus.ingestWorker === 'error' ? 'Error' :
                 systemStatus.ingestWorker === 'idle' ? 'Idle' :
                 systemStatus.ingestWorker === 'checking' ? 'Checking...' : 'Paused'}
              </Badge>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="text-sm font-medium">Tagger</div>
              <Badge 
                variant={
                  systemStatus.tagger === 'active' ? 'default' :
                  systemStatus.tagger === 'error' ? 'destructive' :
                  systemStatus.tagger === 'idle' ? 'outline' : 'secondary'
                } 
                className="mt-1"
              >
                {systemStatus.tagger === 'active' ? 'Active' :
                 systemStatus.tagger === 'error' ? 'Error' :
                 systemStatus.tagger === 'idle' ? 'Idle' :
                 systemStatus.tagger === 'checking' ? 'Checking...' : 'Paused'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🔧 MANUAL TESTING */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 Manual Testing
          </CardTitle>
          <CardDescription>
            Test individual components and automation controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={runRSSFetcher}
                disabled={actionLoading !== null}
                variant="outline"
                className="flex items-center gap-2"
              >
                {actionLoading === 'rss' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rss className="h-4 w-4" />
                )}
                Test RSS Fetcher
              </Button>
              
              <Button 
                onClick={runIngestWorker}
                disabled={actionLoading !== null}
                variant="outline"
                className="flex items-center gap-2"
              >
                {actionLoading === 'ingest' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cog className="h-4 w-4" />
                )}
                Test Ingest Worker
              </Button>
              
              <Button 
                onClick={runTagger}
                disabled={actionLoading !== null}
                variant="outline"
                className="flex items-center gap-2"
              >
                {actionLoading === 'tagger' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tags className="h-4 w-4" />
                )}
                Test Tagger
              </Button>
            </div>

            {/* Automation Control */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Auto Ingest Worker</span>
                  <Badge variant={cronJobs.find(job => job.name === 'auto-ingest-worker')?.enabled ? 'default' : 'secondary'}>
                    {cronJobs.find(job => job.name === 'auto-ingest-worker')?.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <Button
                  onClick={toggleAutoIngest}
                  disabled={actionLoading !== null}
                  size="sm"
                  variant={cronJobs.find(job => job.name === 'auto-ingest-worker')?.enabled ? 'destructive' : 'default'}
                >
                  {actionLoading === 'toggle-auto' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    cronJobs.find(job => job.name === 'auto-ingest-worker')?.enabled ? 'Disable' : 'Enable'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📊 DASHBOARD STATISTICS */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Dashboard Statistics
          </CardTitle>
          <CardDescription>System overview and key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.sourcesCount}</div>
              <p className="text-sm text-muted-foreground">Sources</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.queueCount}</div>
              <p className="text-sm text-muted-foreground">Queue Items</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.usersCount}</div>
              <p className="text-sm text-muted-foreground">Users</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold">{taggingStats.taggedDrops}/{taggingStats.totalDrops}</div>
              <p className="text-sm text-muted-foreground">{taggingStats.taggedPercentage.toFixed(1)}% Tagged</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🎛️ ADVANCED MANAGEMENT */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎛️ Advanced Management
          </CardTitle>
          <CardDescription>Content and system management tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => navigate("/admin/sources")} className="justify-start">
              <Database className="h-4 w-4 mr-2" />
              Gestisci Sorgenti
            </Button>
            
            <Button variant="outline" onClick={() => navigate("/admin/articles")} className="justify-start">
              <Monitor className="h-4 w-4 mr-2" />
              Gestisci Articoli
            </Button>
            
            <Button variant="outline" onClick={() => navigate("/admin/sitemap")} className="justify-start">
              <Map className="h-4 w-4 mr-2" />
              Gestisci Sitemap
            </Button>
            
            <Button variant="outline" onClick={() => navigate("/admin/manual-ingest")} className="justify-start">
              <Globe className="h-4 w-4 mr-2" />
              Manual Ingestion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ⚙️ SYSTEM CONFIGURATION */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⚙️ System Configuration
          </CardTitle>
          <CardDescription>Platform settings and cache management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* UI Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">UI Settings</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Alpha Ribbon</label>
                  <p className="text-xs text-muted-foreground">
                    Show "ALPHA VERSION" badge in top-right corner
                  </p>
                </div>
                <Switch
                  checked={uiSettings.show_alpha_ribbon}
                  onCheckedChange={(checked) => updateUISetting('show_alpha_ribbon', checked)}
                  disabled={actionLoading === 'ui-show_alpha_ribbon'}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Feedback Button</label>
                  <p className="text-xs text-muted-foreground">
                    Show feedback FAB in bottom-right corner
                  </p>
                </div>
                <Switch
                  checked={uiSettings.show_feedback_button}
                  onCheckedChange={(checked) => updateUISetting('show_feedback_button', checked)}
                  disabled={actionLoading === 'ui-show_feedback_button'}
                />
              </div>
            </div>
          </div>
          
          {/* Cache Management */}
          <div className="border-t pt-4">
            <CacheRegenerationTrigger />
          </div>
        </CardContent>
      </Card>

      {/* 🧪 DEVELOPMENT TOOLS */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Development Tools
          </CardTitle>
          <CardDescription>Testing and development utilities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <NewsletterTestPanel />
          <VectorSystemInit />
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;