import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ServiceStatus {
  rss_fetcher: 'active' | 'error' | 'idle';
  ingest_worker: 'active' | 'paused' | 'idle';
  tagger: 'active' | 'paused' | 'idle';
}

export const ServiceStatusIndicators = () => {
  const [status, setStatus] = useState<ServiceStatus>({
    rss_fetcher: 'idle',
    ingest_worker: 'idle',
    tagger: 'idle',
  });

  useEffect(() => {
    fetchServiceStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchServiceStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchServiceStatus = async () => {
    try {
      // Check recent activity in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Check RSS Fetcher status (based on recent ingestion_queue activity)
      const { count: recentRSSActivity } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fiveMinutesAgo);
      
      // Check Ingest Worker status (based on recent processing)
      const { count: recentProcessing } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing');
        
      // Check for errors in the queue
      const { count: errorCount } = await supabase
        .from('ingestion_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error');

      // Check Tagger status (based on recent tag_done updates)
      const { count: recentTagging } = await supabase
        .from('drops')
        .select('*', { count: 'exact', head: true })
        .eq('tag_done', true)
        .gte('created_at', fiveMinutesAgo);

      // Check if auto-ingest is enabled
      const { data: cronJob } = await supabase
        .from('cron_jobs')
        .select('enabled')
        .eq('name', 'auto-ingest-worker')
        .single();

      const autoIngestEnabled = cronJob?.enabled ?? false;

      // Determine statuses
      let rssStatus: ServiceStatus['rss_fetcher'] = 'idle';
      if (errorCount && errorCount > 100) {
        rssStatus = 'error';
      } else if (recentRSSActivity && recentRSSActivity > 0) {
        rssStatus = 'active';
      }

      let ingestStatus: ServiceStatus['ingest_worker'] = autoIngestEnabled ? 'idle' : 'paused';
      if (recentProcessing && recentProcessing > 0) {
        ingestStatus = 'active';
      }

      let taggerStatus: ServiceStatus['tagger'] = 'idle';
      if (recentTagging && recentTagging > 0) {
        taggerStatus = 'active';
      }

      setStatus({
        rss_fetcher: rssStatus,
        ingest_worker: ingestStatus,
        tagger: taggerStatus,
      });
    } catch (error) {
      console.error('Error fetching service status:', error);
      // Default to error state on failure
      setStatus({
        rss_fetcher: 'error',
        ingest_worker: 'paused',
        tagger: 'paused',
      });
    }
  };

  const getStatusBadge = (serviceName: string, status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="mt-1">Active</Badge>;
      case 'error':
        return <Badge variant="destructive" className="mt-1">Error</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="mt-1">Paused</Badge>;
      case 'idle':
      default:
        return <Badge variant="outline" className="mt-1">Idle</Badge>;
    }
  };

  return (
    <div className="mt-4 grid grid-cols-3 gap-4">
      <div className="text-center p-2 bg-muted rounded">
        <div className="text-sm font-medium">RSS Fetcher</div>
        {getStatusBadge('RSS Fetcher', status.rss_fetcher)}
      </div>
      <div className="text-center p-2 bg-muted rounded">
        <div className="text-sm font-medium">Ingest Worker</div>
        {getStatusBadge('Ingest Worker', status.ingest_worker)}
      </div>
      <div className="text-center p-2 bg-muted rounded">
        <div className="text-sm font-medium">Tagger</div>
        {getStatusBadge('Tagger', status.tagger)}
      </div>
    </div>
  );
};