import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, Clock, XCircle, Activity, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SystemHealth {
  ingestion_queue: {
    total_pending: number;
    total_errors: number;
    high_retry_items: number;
    oldest_pending: string | null;
  };
  drops: {
    total_drops: number;
    tagged_drops: number;
    untagged_drops: number;
    recent_drops_24h: number;
  };
  sources: {
    total_sources: number;
    active_sources: number;
    paused_sources: number;
    error_sources: number;
  };
  edge_functions: {
    recent_errors: number;
    last_successful_ingestion: string | null;
  };
  alerts: string[];
  recommendations: string[];
}

const SystemMonitorPanel = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'critical' | 'error'>('healthy');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSystemHealth = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('system-monitor');
      
      if (error) throw error;
      
      setHealth(data.health);
      setSystemStatus(data.system_status);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      setSystemStatus('error');
      toast({
        title: "Monitoring Error",
        description: "Failed to fetch system health data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchSystemHealth, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'critical':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sistema di Monitoraggio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Caricamento dati di sistema...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sistema di Monitoraggio
            {getStatusIcon(systemStatus)}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(systemStatus)}>
              {systemStatus.toUpperCase()}
            </Badge>
            <Button
              onClick={fetchSystemHealth}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground">
            Ultimo aggiornamento: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Alerts Section */}
        {health.alerts.length > 0 && (
          <div>
            <h4 className="font-semibold text-red-600 mb-2">🚨 Allerte Attive</h4>
            <div className="space-y-1">
              {health.alerts.map((alert, index) => (
                <div key={index} className="text-sm bg-red-50 border border-red-200 rounded p-2">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {health.recommendations.length > 0 && (
          <div>
            <h4 className="font-semibold text-blue-600 mb-2">💡 Raccomandazioni</h4>
            <div className="space-y-1">
              {health.recommendations.map((rec, index) => (
                <div key={index} className="text-sm bg-blue-50 border border-blue-200 rounded p-2">
                  {rec}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* System Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Ingestion Queue */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Coda di Ingestione</h4>
            <div className="space-y-1 text-xs">
              <div>Pending: {health.ingestion_queue.total_pending}</div>
              <div>Errori: {health.ingestion_queue.total_errors}</div>
              <div>Tentativi multipli: {health.ingestion_queue.high_retry_items}</div>
            </div>
          </div>

          {/* Content Drops */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Contenuti</h4>
            <div className="space-y-1 text-xs">
              <div>Totale: {health.drops.total_drops}</div>
              <div>Taggati: {health.drops.tagged_drops}</div>
              <div>Non taggati: {health.drops.untagged_drops}</div>
              <div>Ultimi 24h: {health.drops.recent_drops_24h}</div>
            </div>
          </div>

          {/* Sources */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Sorgenti</h4>
            <div className="space-y-1 text-xs">
              <div>Totali: {health.sources.total_sources}</div>
              <div>Attive: {health.sources.active_sources}</div>
              <div>In pausa: {health.sources.paused_sources}</div>
              <div>Con errori: {health.sources.error_sources}</div>
            </div>
          </div>

          {/* Edge Functions */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Edge Functions</h4>
            <div className="space-y-1 text-xs">
              <div>Errori recenti: {health.edge_functions.recent_errors}</div>
              <div className="truncate">
                Ultima ingestione: {health.edge_functions.last_successful_ingestion 
                  ? new Date(health.edge_functions.last_successful_ingestion).toLocaleDateString()
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        </div>

        {/* System Status Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Stato Sistema</h4>
              <p className="text-sm text-muted-foreground">
                {health.alerts.length} allerte, {health.recommendations.length} raccomandazioni
              </p>
            </div>
            <Badge variant={getStatusVariant(systemStatus)} className="text-lg px-3 py-1">
              {systemStatus.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemMonitorPanel;