import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminStats {
  lastRunArticles: number;
  last24hArticles: number;
  totalArticles: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  trendLast7d: number;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      // Get total articles
      const { count: totalArticles } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true });

      // Get articles from last 24 hours (Rome timezone: UTC+1 or UTC+2 depending on DST)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { count: last24hArticles } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo.toISOString());

      // Get last ingestion run articles
      const { data: lastLog } = await supabase
        .from('ingestion_logs')
        .select('new_articles')
        .order('cycle_timestamp', { ascending: false })
        .limit(1)
        .single();

      // Get 7-day trend (compare this week vs last week)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const { count: thisWeek } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      const { count: lastWeek } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      const trendLast7d = lastWeek && lastWeek > 0
        ? ((thisWeek || 0) - lastWeek) / lastWeek * 100
        : 0;

      // Determine health status
      const { count: recentErrorsCount } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('updated_at', twentyFourHoursAgo.toISOString());

      const { data: recentSuccess } = await supabase
        .from('cron_execution_log')
        .select('success')
        .order('executed_at', { ascending: false })
        .limit(10);

      const successRate = recentSuccess
        ? recentSuccess.filter((log) => log.success).length / recentSuccess.length
        : 1;

      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (successRate < 0.8 || (recentErrorsCount && recentErrorsCount > 100)) {
        healthStatus = 'critical';
      } else if (successRate < 0.95 || (recentErrorsCount && recentErrorsCount > 50)) {
        healthStatus = 'warning';
      }

      setStats({
        lastRunArticles: lastLog?.new_articles || 0,
        last24hArticles: last24hArticles || 0,
        totalArticles: totalArticles || 0,
        healthStatus,
        trendLast7d,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: fetchStats };
}
