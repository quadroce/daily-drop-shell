import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Activity, 
  Database,
  Users,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Home
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { requireSession } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/hooks/useAdminStats";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface GAStats {
  sessions7d: number;
  users7d: number;
  pageviews7d: number;
  sessionsTrend: number;
  usersTrend: number;
  pageviewsTrend: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useAdminStats();
  const [gaStats, setGaStats] = useState<GAStats | null>(null);
  const [gaLoading, setGaLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
    fetchGAStats();
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
        navigate('/feed');
        return;
      }
    } catch (error) {
      console.error('Access check failed:', error);
      toast({
        title: "Authentication Error",
        description: "Please login as an admin to access this page.",
        variant: "destructive",
      });
      navigate('/feed');
    } finally {
      setLoading(false);
    }
  };

  const fetchGAStats = async () => {
    try {
      // Placeholder for Google Analytics API integration
      // In production, this would call the GA API or a backend endpoint
      // For now, using mock data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setGaStats({
        sessions7d: 12543,
        users7d: 8932,
        pageviews7d: 45621,
        sessionsTrend: 12.5,
        usersTrend: 8.3,
        pageviewsTrend: 15.7,
      });
    } catch (error) {
      console.error('Error fetching GA stats:', error);
    } finally {
      setGaLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderKPI = (
    title: string,
    value: number | string,
    trend: number | null,
    icon: React.ReactNode
  ) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        {trend !== null && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}% vs prev 7d
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Product analytics and system health</p>
        </div>
      </div>

      {/* Content KPIs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Content Metrics</h2>
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderKPI(
              "Last Run",
              stats.lastRunArticles,
              null,
              <Activity className="h-4 w-4 text-muted-foreground" />
            )}
            {renderKPI(
              "Last 24h",
              stats.last24hArticles,
              null,
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            )}
            {renderKPI(
              "Total Articles",
              stats.totalArticles,
              stats.trendLast7d,
              <Database className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ) : null}
      </div>

      {/* Google Analytics KPIs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Product Analytics (7 days)</h2>
        {gaLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : gaStats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderKPI(
              "Sessions",
              gaStats.sessions7d,
              gaStats.sessionsTrend,
              <Activity className="h-4 w-4 text-muted-foreground" />
            )}
            {renderKPI(
              "Users",
              gaStats.users7d,
              gaStats.usersTrend,
              <Users className="h-4 w-4 text-muted-foreground" />
            )}
            {renderKPI(
              "Pageviews",
              gaStats.pageviews7d,
              gaStats.pageviewsTrend,
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ) : null}
      </div>

      {/* Ingestion Health */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Ingestion Health
              {stats && (
                <Badge 
                  variant={
                    stats.healthStatus === 'healthy' ? 'default' :
                    stats.healthStatus === 'warning' ? 'secondary' : 'destructive'
                  }
                  className="flex items-center gap-1"
                >
                  {stats.healthStatus === 'healthy' ? (
                    <><CheckCircle className="h-3 w-3" /> Healthy</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3" /> {stats.healthStatus.charAt(0).toUpperCase() + stats.healthStatus.slice(1)}</>
                  )}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Automated ingestion pipeline status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-20" />
            ) : stats ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Success Rate (7d)</span>
                  <span className="text-lg font-semibold">
                    {stats.healthStatus === 'healthy' ? '≥95%' : stats.healthStatus === 'warning' ? '80-94%' : '<80%'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last 7d Trend</span>
                  <span className={`text-lg font-semibold ${stats.trendLast7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.trendLast7d > 0 ? '+' : ''}{stats.trendLast7d.toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Navigation to detailed tools */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Tools</CardTitle>
          <CardDescription>Quick access to administration features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href="/admin/cron">Cron Jobs Management</a>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href="/admin/sources">Sources Management</a>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href="/admin/users">Users Management</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
