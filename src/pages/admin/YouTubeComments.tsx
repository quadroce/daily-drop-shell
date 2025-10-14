import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Youtube, MessageSquare, Play, Pause, Settings as SettingsIcon } from "lucide-react";
import { YouTubeCommentsTable } from "@/components/admin/youtube/YouTubeCommentsTable";
import { YouTubeJobsManager } from "@/components/admin/YouTubeJobsManager";
import { useToast } from "@/hooks/use-toast";

const YouTubeComments = () => {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);

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
          .eq("key", "youtube_comments_enabled")
          .single();
        
        setSystemEnabled((settings?.value as { enabled?: boolean })?.enabled ?? false);
        setLoading(false);
      } catch (error) {
        console.error("Access check error:", error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [authLoading, navigate]);

  const toggleSystem = async () => {
    setToggling(true);
    try {
      const newState = !systemEnabled;
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "youtube_comments_enabled",
          value: { enabled: newState },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSystemEnabled(newState);
      toast({
        title: newState ? "System Enabled" : "System Disabled",
        description: `YouTube auto-comments are now ${newState ? 'active' : 'paused'}`,
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
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">YouTube Comments</h1>
              <p className="text-muted-foreground">Auto-comment system for awareness</p>
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
          <TabsTrigger value="manager">Manager</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-6">
          <YouTubeCommentsTable />
        </TabsContent>

        <TabsContent value="manager" className="space-y-6">
          <YouTubeJobsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default YouTubeComments;
