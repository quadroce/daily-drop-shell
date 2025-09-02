import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Database, List, ArrowLeft, Rss, Cog, Tags } from "lucide-react";

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

interface CronJob {
  name: string;
  enabled: boolean;
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
      const { count: sourcesCount } = await supabase
        .from('sources')
        .select('*', { count: 'exact', head: true });

      // Fetch queue count (pending items)
      const { count: queueCount } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setStats({
        sourcesCount: sourcesCount || 0,
        queueCount: queueCount || 0,
        usersCount: usersCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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

  // Admin action handlers
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
      console.log('RSS Fetcher result:', result);
      
      // Handle both success and error responses
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
      
      const { error } = await supabase
        .from('cron_jobs')
        .update({ enabled: newStatus, updated_at: new Date().toISOString() })
        .eq('name', 'auto-ingest-worker');

      if (error) throw error;

      // Update local state
      setCronJobs(prev => prev.map(job => 
        job.name === 'auto-ingest-worker' 
          ? { ...job, enabled: newStatus }
          : job
      ));

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

      {/* Dashboard cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sourcesCount}</div>
            <p className="text-xs text-muted-foreground">
              Content sources management
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.queueCount}</div>
            <p className="text-xs text-muted-foreground">
              Pending items in queue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usersCount}</div>
            <p className="text-xs text-muted-foreground">
              Registered users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
          <CardDescription>
            Trigger backend processes manually
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Manual Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={runRSSFetcher}
                disabled={actionLoading !== null}
                className="flex items-center gap-2"
              >
                {actionLoading === 'rss' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rss className="h-4 w-4" />
                )}
                Run RSS Fetcher now
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
                Run Ingest Worker now (50 items)
              </Button>
              
              <Button 
                onClick={runTagger}
                disabled={actionLoading !== null}
                variant="secondary"
                className="flex items-center gap-2"
              >
                {actionLoading === 'tagger' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tags className="h-4 w-4" />
                )}
                Run Tagger now
              </Button>
            </div>

            {/* Automation Controls */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Automation</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Auto Ingest Worker</span>
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
              <p className="text-xs text-muted-foreground mt-2">
                Processes queue items automatically every 5 minutes (50 items per batch)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-sm">Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-mono space-y-1">
            <div>User ID: {user?.id}</div>
            <div>Role: {profile?.role}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;