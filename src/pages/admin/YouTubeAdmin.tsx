import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Youtube } from "lucide-react";
import { YouTubeCredentialsStatus } from "@/components/admin/youtube/YouTubeCredentialsStatus";
import { YouTubeOAuthPanel } from "@/components/admin/youtube/YouTubeOAuthPanel";
import { YouTubeShortsConfig } from "@/components/admin/youtube/YouTubeShortsConfig";
import { YouTubeUtilities } from "@/components/admin/youtube/YouTubeUtilities";
import { YouTubeLogsTable } from "@/components/admin/youtube/YouTubeLogsTable";
import { ShortsPublishPanel } from "@/components/admin/ShortsPublishPanel";
import { YouTubeCommentsTable } from "@/components/admin/youtube/YouTubeCommentsTable";

const YouTubeAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

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
        
        setLoading(false);
      } catch (error) {
        console.error("Access check error:", error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [authLoading, navigate]);

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
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Youtube className="h-8 w-8 text-red-600" />
            <div>
              <h1 className="text-3xl font-bold">YouTube Administration</h1>
              <p className="text-muted-foreground">Manage YouTube integration, OAuth, and automation</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          Admin Only
        </Badge>
      </div>

      {/* Dashboard Grid */}
      <div className="grid gap-6">
        {/* Credentials Status */}
        <YouTubeCredentialsStatus />

        {/* OAuth & Channel */}
        <YouTubeOAuthPanel />

        {/* Shorts Automation Config */}
        <YouTubeShortsConfig />

        {/* Shorts Publish Panel */}
        <ShortsPublishPanel />

        {/* Utilities */}
        <YouTubeUtilities />

        {/* Comments Management */}
        <YouTubeCommentsTable />

        {/* Logs Table */}
        <YouTubeLogsTable />
      </div>
    </div>
  );
};

export default YouTubeAdmin;
