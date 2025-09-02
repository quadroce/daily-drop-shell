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

const Admin = () => {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        setLoading(false);
      } catch (error) {
        console.error("Access check error:", error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [authLoading, navigate]);

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
      const result = await response.json();
      
      toast({
        title: "RSS Fetcher Complete",
        description: `Processed ${result.sources} sources, enqueued ${result.enqueued} items`,
      });
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
        }
      });
      const result = await response.json();
      
      toast({
        title: "Ingest Worker Complete",
        description: `Processed ${result.processed} items, ${result.done} successful, ${result.errors} errors`,
      });
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
      const result = await response.json();
      
      toast({
        title: "Tagger Complete",
        description: `Processed ${result.processed} drops, ${result.tagged} tagged successfully`,
      });
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
            <div className="text-2xl font-bold">-</div>
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
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Ingestion queue status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
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
              Run Ingest Worker now
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