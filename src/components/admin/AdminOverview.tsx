import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, Database, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewStats {
  lastRunArticles: number;
  last24hArticles: number;
  totalArticles: number;
  healthStatus: "healthy" | "warning" | "critical";
  trendLast7d: number; // percentage change
}

interface AdminOverviewProps {
  stats: OverviewStats | null;
  loading: boolean;
}

export function AdminOverview({ stats, loading }: AdminOverviewProps) {
  if (loading || !stats) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>System health and key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthVariant =
    stats.healthStatus === "healthy" ? "default" :
    stats.healthStatus === "warning" ? "secondary" : "destructive";

  const healthIcon =
    stats.healthStatus === "healthy" ? Activity :
    stats.healthStatus === "warning" ? AlertTriangle : AlertTriangle;

  const HealthIcon = healthIcon;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Overview</CardTitle>
            <CardDescription>System health and key metrics</CardDescription>
          </div>
          <Badge variant={healthVariant} className="flex items-center gap-1">
            <HealthIcon className="h-3 w-3" />
            {stats.healthStatus.charAt(0).toUpperCase() + stats.healthStatus.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Last Run Articles */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Last Run</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats.lastRunArticles}</div>
            <p className="text-xs text-muted-foreground mt-1">Articles ingested</p>
          </div>

          {/* Last 24h Articles */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Last 24h</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats.last24hArticles}</div>
            <p className="text-xs text-muted-foreground mt-1">Articles ingested</p>
          </div>

          {/* Total Articles */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{stats.totalArticles.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </div>

          {/* 7-day Trend */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">7d Trend</span>
              <TrendingUp className={`h-4 w-4 ${stats.trendLast7d >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div className={`text-2xl font-bold ${stats.trendLast7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.trendLast7d > 0 ? '+' : ''}{stats.trendLast7d.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs previous 7d</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
