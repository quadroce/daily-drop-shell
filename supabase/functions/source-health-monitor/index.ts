import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SourceHealth {
  source_id: number;
  consecutive_errors: number;
  last_error_at: string;
  error_type: string;
  is_paused: boolean;
  paused_until: string | null;
  last_success_at: string;
}

interface SourceWithHealth {
  id: number;
  name: string;
  feed_url: string;
  status: string;
  source_health?: SourceHealth[];
  health?: SourceHealth[];
}

interface HealthReport {
  total_sources: number;
  healthy_sources: number;
  paused_sources: number;
  error_sources: number;
  ready_for_resume: number;
  critical_issues: Array<{
    source_id: number;
    source_name: string;
    issue: string;
    consecutive_errors: number;
    last_error: string;
  }>;
  sources_resumed: number;
}

async function getSourcesWithHealth(): Promise<SourceWithHealth[]> {
  // Fetch sources with their health status
  const sourcesResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/sources?status=eq.active&feed_url=not.is.null&select=id,name,feed_url,status,source_health(*)`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!sourcesResponse.ok) {
    throw new Error(`Failed to fetch sources: ${sourcesResponse.status}`);
  }

  return await sourcesResponse.json();
}

async function resumeSource(sourceId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/source_health?source_id=eq.${sourceId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_paused: false,
          paused_until: null,
          consecutive_errors: 0,
          updated_at: new Date().toISOString()
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Failed to resume source ${sourceId}:`, error);
    return false;
  }
}

async function generateHealthReport(): Promise<HealthReport> {
  const sources = await getSourcesWithHealth();
  const now = new Date();
  
  const report: HealthReport = {
    total_sources: sources.length,
    healthy_sources: 0,
    paused_sources: 0,
    error_sources: 0,
    ready_for_resume: 0,
    critical_issues: [],
    sources_resumed: 0,
  };

  for (const source of sources) {
    const health = (source.source_health || source.health)?.[0]; // source_health is an array due to join
    
    if (!health) {
      // No health record means it's healthy (new source)
      report.healthy_sources++;
      continue;
    }

    if (health.is_paused) {
      report.paused_sources++;
      
      // Check if source is ready to be resumed
      if (health.paused_until) {
        const pauseEndTime = new Date(health.paused_until);
        if (now > pauseEndTime) {
          report.ready_for_resume++;
          
          // Automatically resume the source
          const resumed = await resumeSource(source.id);
          if (resumed) {
            report.sources_resumed++;
            console.log(`Automatically resumed source ${source.id}: ${source.name}`);
          }
        }
      }
    } else if (health.consecutive_errors > 0) {
      report.error_sources++;
      
      // Flag critical issues (5+ consecutive errors)
      if (health.consecutive_errors >= 5) {
        report.critical_issues.push({
          source_id: source.id,
          source_name: source.name,
          issue: `${health.consecutive_errors} consecutive errors (${health.error_type})`,
          consecutive_errors: health.consecutive_errors,
          last_error: health.last_error_at
        });
      }
    } else {
      report.healthy_sources++;
    }
  }

  return report;
}

async function getTopFailingSources(limit: number = 10) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/source_health?consecutive_errors=gte.1&select=source_id,consecutive_errors,error_type,last_error_at,sources!inner(name,feed_url)&order=consecutive_errors.desc&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch failing sources: ${response.status}`);
  }

  return await response.json();
}

async function getIngestionStats() {
  // Get recent ingestion statistics
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ingestion_logs?order=created_at.desc&limit=1&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ingestion stats: ${response.status}`);
  }

  const logs = await response.json();
  return logs[0] || null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'report';

    console.log(`Source health monitor - action: ${action}`);

    switch (action) {
      case 'report': {
        const report = await generateHealthReport();
        const recentStats = await getIngestionStats();
        
        return new Response(JSON.stringify({
          health_report: report,
          last_ingestion: recentStats,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'failing': {
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const failingSources = await getTopFailingSources(limit);
        
        return new Response(JSON.stringify({
          failing_sources: failingSources,
          count: failingSources.length,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resume': {
        const sourceId = url.searchParams.get('source_id');
        if (!sourceId) {
          return new Response(JSON.stringify({ 
            error: 'source_id parameter required' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const resumed = await resumeSource(parseInt(sourceId, 10));
        
        return new Response(JSON.stringify({
          success: resumed,
          source_id: parseInt(sourceId, 10),
          message: resumed ? 'Source resumed successfully' : 'Failed to resume source'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'auto-resume': {
        // Automatically resume all sources that have passed their pause period
        const sources = await getSourcesWithHealth();
        const now = new Date();
        let resumedCount = 0;

        for (const source of sources) {
          const health = (source.source_health || source.health)?.[0];
          if (health?.is_paused && health.paused_until) {
            const pauseEndTime = new Date(health.paused_until);
            if (now > pauseEndTime) {
              const resumed = await resumeSource(source.id);
              if (resumed) {
                resumedCount++;
                console.log(`Auto-resumed source ${source.id}: ${source.name}`);
              }
            }
          }
        }

        return new Response(JSON.stringify({
          sources_resumed: resumedCount,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid action. Use: report, failing, resume, or auto-resume' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Error in source-health-monitor:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
CURL EXAMPLES:

# Get health report
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/source-health-monitor?action=report"

# Get top failing sources
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/source-health-monitor?action=failing&limit=20"

# Resume a specific source
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/source-health-monitor?action=resume&source_id=123"

# Auto-resume all eligible sources
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/source-health-monitor?action=auto-resume"
*/