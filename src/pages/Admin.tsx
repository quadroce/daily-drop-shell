import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Globe, Database, List, Users, Rss, Map, Youtube, Linkedin, Plus, Settings } from "lucide-react";
import { AdminTile } from "@/components/admin/AdminTile";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { useAdminStats } from "@/hooks/useAdminStats";

interface Profile {
  id: string;
  email: string;
  role: string;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { stats, loading: statsLoading } = useAdminStats();

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

        setProfile(profileData);
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

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Not authorized view
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="text-muted-foreground mt-2">
            Manage your DailyDrops platform
          </p>
        </div>
        
        {profile && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">{profile.email}</span>
            <Badge variant="secondary">{profile.role}</Badge>
          </div>
        )}
      </div>

      {/* Overview Section */}
      <AdminOverview stats={stats} loading={statsLoading} />

      {/* Content Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Content</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AdminTile
            to="/admin/articles"
            icon={List}
            title="Articles"
            subtitle="View & manage drops"
          />
          <AdminTile
            to="/admin/linkedin"
            icon={Linkedin}
            title="LinkedIn Archive"
            subtitle="Daily topic shares"
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Ingestion Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Ingestion</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AdminTile
            to="/admin/sources"
            icon={Database}
            title="Sources"
            subtitle="Manage RSS feeds"
          />
          <AdminTile
            to="/admin/manual-ingest"
            icon={Rss}
            title="Manual Ingest"
            subtitle="Add content manually"
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Users Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AdminTile
            to="/admin/users"
            icon={Users}
            title="Users"
            subtitle="User management"
          />
          <AdminTile
            to="/admin/partners"
            icon={Globe}
            title="Partners"
            subtitle="Manage partner pages"
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* System Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">System</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AdminTile
            to="/admin/sitemap"
            icon={Map}
            title="Sitemap"
            subtitle="SEO & indexing"
          />
          <AdminTile
            to="/admin/cron"
            icon={Settings}
            title="Cron Jobs"
            subtitle="Scheduled tasks"
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Social Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Social</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AdminTile
            to="/admin/youtube"
            icon={Youtube}
            title="YouTube"
            subtitle="OAuth, automation & logs"
            variant="highlight"
          />
        </div>
      </div>

      {/* Legacy Dashboard Link */}
      <Card className="mt-8 border-dashed">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Legacy Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Access detailed system monitoring and debug tools
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/dashboard">
                Open Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
