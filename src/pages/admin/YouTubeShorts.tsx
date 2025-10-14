import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Video, Play, Pause, Youtube, Linkedin } from "lucide-react";
import { ShortsPublishPanel } from "@/components/admin/ShortsPublishPanel";
import { YouTubeShortsConfig } from "@/components/admin/youtube/YouTubeShortsConfig";
import { useToast } from "@/hooks/use-toast";

interface ShortJob {
  id: number;
  platform: string;
  topic_slug: string;
  kind: string;
  scheduled_for: string;
  status: string;
  tries: number;
  error_code?: string;
  error_message?: string;
  external_id?: string;
  created_at: string;
}

const YouTubeShorts = () => {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [jobs, setJobs] = useState<ShortJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        navigate("/auth");
        return;
      }

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

        const isAdmin = profileData?.role === 'admin' || profileData?.role === 'superadmin';
        setIsAuthorized(isAdmin);
        
        if (!isAdmin) {
          navigate("/");
        }
        
        // Check system status
        const { data: settings } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "shorts_automation_enabled")
          .single();
        
        setSystemEnabled((settings?.value as { enabled?: boolean })?.enabled ?? false);
        await loadJobs();
        setLoading(false);
      } catch (error) {
        console.error("Access check error:", error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [authLoading, navigate]);

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("short_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading jobs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  };

  const toggleSystem = async () => {
    setToggling(true);
    try {
      const newState = !systemEnabled;
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "shorts_automation_enabled",
          value: { enabled: newState },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSystemEnabled(newState);
      toast({
        title: newState ? "System Enabled" : "System Disabled",
        description: `Shorts automation is now ${newState ? 'active' : 'paused'}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      queued: "secondary",
      running: "default",
      done: "outline",
      error: "destructive",
      skipped: "secondary",
      canceled: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getPlatformIcon = (platform: string) => {
    return platform === "youtube" 
      ? <Youtube className="h-4 w-4 text-red-600" />
      : <Linkedin className="h-4 w-4 text-blue-600" />;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/youtube">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Video className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Shorts Automation</h1>
              <p className="text-muted-foreground">Control center for YouTube & LinkedIn shorts</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={systemEnabled ? "default" : "secondary"}>
            {systemEnabled ? "Enabled" : "Paused"}
          </Badge>
          <Button
            onClick={toggleSystem}
            disabled={toggling}
            variant={systemEnabled ? "destructive" : "default"}
            size="sm"
          >
            {systemEnabled ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {systemEnabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="publishers">Publishers</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Shorts Jobs</CardTitle>
                  <CardDescription>Recent automation jobs across platforms</CardDescription>
                </div>
                <Button onClick={loadJobs} disabled={loadingJobs} size="sm" variant="outline">
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingJobs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No jobs found. Create one from the Publishers tab.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tries</TableHead>
                      <TableHead>External ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(job.platform)}
                            <span className="capitalize">{job.platform}</span>
                          </div>
                        </TableCell>
                        <TableCell>{job.topic_slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.kind}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(job.scheduled_for).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>{job.tries}</TableCell>
                        <TableCell>
                          {job.external_id ? (
                            <code className="text-xs">{job.external_id.slice(0, 20)}...</code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publishers" className="space-y-6">
          <ShortsPublishPanel />
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <YouTubeShortsConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YouTubeShorts;
