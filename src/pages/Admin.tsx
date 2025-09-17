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
import { Loader2, Users, Database, List, ArrowLeft, Rss, Cog, Tags, Monitor, Map, Globe, Youtube, Settings } from "lucide-react";

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
        
        // Refresh tagging stats after processing
        await fetchTaggingStats();
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

  const runYouTubeReprocessing = async () => {
    setActionLoading('youtube-reprocessing');
    try {
      const { data, error } = await supabase.functions.invoke('admin-api/youtube-reprocess', {
        body: {}
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        toast({
          title: "YouTube Reprocessing Started",
          description: `Processed ${data.processed} videos. ${data.remaining} remaining. ${data.errors > 0 ? `${data.errors} errors.` : ''}`,
        });
        
        // Refresh tagging stats after processing
        await fetchTaggingStats();
      } else {
        toast({
          title: "YouTube Reprocessing Error",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('YouTube reprocessing error:', error);
      toast({
        title: "YouTube Reprocessing Error", 
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
        
          {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Button variant="success" onClick={() => navigate("/admin/sources")}>
            <Database className="h-4 w-4 mr-2" />
            Gestisci Sorgenti
          </Button>
          
          <Button variant="warning" onClick={() => navigate("/admin/articles")}>
            <Monitor className="h-4 w-4 mr-2" />
            Gestisci Articoli
          </Button>
          
          <Button variant="default" onClick={() => navigate("/admin/sitemap")}>
            <Map className="h-4 w-4 mr-2" />
            Gestisci Sitemap
          </Button>
          
          <Button variant="destructive" onClick={() => navigate("/admin/manual-ingest")}>
            <Globe className="h-4 w-4 mr-2" />
            Manual Ingestion
          </Button>
          
          {/* Profile badge */}
          {profile && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">{profile.email}</span>
              <Badge variant="secondary">{profile.role}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/admin/sources")}>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles Tagged</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taggingStats.taggedDrops}/{taggingStats.totalDrops}</div>
            <p className="text-xs text-muted-foreground">
              {taggingStats.taggedPercentage.toFixed(1)}% completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tagging Statistics */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Tagging Statistics</CardTitle>
          <CardDescription>
            Content tagging and analysis overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Progress Stats */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Progress Overview</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Articles</span>
                  <span className="font-medium">{taggingStats.totalDrops}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tagged</span>
                  <span className="font-medium text-green-600">{taggingStats.taggedDrops}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Remaining</span>
                  <span className="font-medium text-orange-600">{taggingStats.untaggedDrops}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-medium">Completion</span>
                  <span className="font-bold text-primary">{taggingStats.taggedPercentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Top Tags */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Most Popular Tags</h4>
              <div className="space-y-2">
                {topTags.slice(0, 8).map((tag, index) => (
                  <div key={tag.tag} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">#{index + 1}</span>
                      <Badge variant="outline" className="text-xs">{tag.tag}</Badge>
                    </div>
                    <span className="text-sm font-medium">{tag.frequency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>System Monitoring</CardTitle>
          <CardDescription>Monitor automated content ingestion and system health</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <Button asChild>
              <Link to="/admin/dashboard" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Open Admin Dashboard
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              View real-time stats, manage cron jobs, and monitor ingestion logs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* UI Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            UI Settings
          </CardTitle>
          <CardDescription>
            Control UI elements visibility across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
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
        </CardContent>
      </Card>

      {/* Vector System Initialization */}
      <VectorSystemInit />

      {/* Admin Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Manual Actions</CardTitle>
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
              
              <Button 
                onClick={runYouTubeReprocessing}
                disabled={actionLoading !== null}
                variant="destructive"
                className="flex items-center gap-2"
              >
                {actionLoading === 'youtube-reprocessing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Youtube className="h-4 w-4" />
                )}
                Reprocess YouTube Videos
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