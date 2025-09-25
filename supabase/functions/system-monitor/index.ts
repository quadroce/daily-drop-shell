import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SystemHealth {
  ingestion_queue: {
    total_pending: number
    total_errors: number
    high_retry_items: number
    oldest_pending: string | null
  }
  drops: {
    total_drops: number
    tagged_drops: number
    untagged_drops: number
    recent_drops_24h: number
  }
  sources: {
    total_sources: number
    active_sources: number
    paused_sources: number
    error_sources: number
  }
  edge_functions: {
    recent_errors: number
    last_successful_ingestion: string | null
  }
  alerts: string[]
  recommendations: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('📊 Starting system health monitoring...')

    const health: SystemHealth = {
      ingestion_queue: {
        total_pending: 0,
        total_errors: 0,
        high_retry_items: 0,
        oldest_pending: null
      },
      drops: {
        total_drops: 0,
        tagged_drops: 0,
        untagged_drops: 0,
        recent_drops_24h: 0
      },
      sources: {
        total_sources: 0,
        active_sources: 0,
        paused_sources: 0,
        error_sources: 0
      },
      edge_functions: {
        recent_errors: 0,
        last_successful_ingestion: null
      },
      alerts: [],
      recommendations: []
    }

    // Check ingestion queue health
    const { data: queueStats } = await supabase
      .from('ingestion_queue')
      .select('status, tries, created_at, error')

    if (queueStats) {
      health.ingestion_queue.total_pending = queueStats.filter(q => q.status === 'pending').length
      health.ingestion_queue.total_errors = queueStats.filter(q => q.status === 'error').length
      health.ingestion_queue.high_retry_items = queueStats.filter(q => q.tries >= 3).length
      
      const oldestPending = queueStats
        .filter(q => q.status === 'pending')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
      
      health.ingestion_queue.oldest_pending = oldestPending?.created_at || null
    }

    // Check drops health
    const { data: dropsCount } = await supabase
      .from('drops')
      .select('id, tag_done, created_at')

    if (dropsCount) {
      health.drops.total_drops = dropsCount.length
      health.drops.tagged_drops = dropsCount.filter(d => d.tag_done).length
      health.drops.untagged_drops = dropsCount.filter(d => !d.tag_done).length
      
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      health.drops.recent_drops_24h = dropsCount.filter(d => 
        new Date(d.created_at) > yesterday
      ).length
    }

    // Check sources health
    const { data: sources } = await supabase
      .from('sources')
      .select('id, status')

    const { data: sourceHealth } = await supabase
      .from('source_health')
      .select('source_id, is_paused, consecutive_errors')

    if (sources) {
      health.sources.total_sources = sources.length
      health.sources.active_sources = sources.filter(s => s.status === 'active').length
    }

    if (sourceHealth) {
      health.sources.paused_sources = sourceHealth.filter(sh => sh.is_paused).length
      health.sources.error_sources = sourceHealth.filter(sh => sh.consecutive_errors >= 3).length
    }

    // Check recent ingestion logs
    const { data: recentLogs } = await supabase
      .from('ingestion_logs')
      .select('success, created_at, errors')
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentLogs) {
      const successfulLog = recentLogs.find(log => log.success)
      health.edge_functions.last_successful_ingestion = successfulLog?.created_at || null
      health.edge_functions.recent_errors = recentLogs.filter(log => !log.success).length
    }

    // Generate alerts based on health metrics
    if (health.ingestion_queue.total_pending > 500) {
      health.alerts.push(`🚨 High pending queue: ${health.ingestion_queue.total_pending} items`)
    }

    if (health.ingestion_queue.high_retry_items > 100) {
      health.alerts.push(`⚠️ High retry items: ${health.ingestion_queue.high_retry_items} items failing repeatedly`)
    }

    if (health.drops.untagged_drops > 200) {
      health.alerts.push(`🏷️ Many untagged drops: ${health.drops.untagged_drops} items need tagging`)
    }

    if (health.drops.recent_drops_24h < 50) {
      health.alerts.push(`📉 Low ingestion rate: Only ${health.drops.recent_drops_24h} drops in last 24h`)
    }

    if (health.sources.paused_sources > 10) {
      health.alerts.push(`⏸️ Many paused sources: ${health.sources.paused_sources} sources need attention`)
    }

    if (health.edge_functions.recent_errors > 5) {
      health.alerts.push(`🔥 Edge function errors: ${health.edge_functions.recent_errors} recent failures`)
    }

    // Generate recommendations
    if (health.ingestion_queue.total_pending > 200) {
      health.recommendations.push('Run cleanup-ingestion-queue to remove problematic items')
    }

    if (health.drops.untagged_drops > 100) {
      health.recommendations.push('Run tag-drops function to process untagged content')
    }

    if (health.sources.error_sources > 5) {
      health.recommendations.push('Review and fix source health issues')
    }

    if (health.drops.recent_drops_24h < 100) {
      health.recommendations.push('Check RSS feeds and ingestion pipeline')
    }

    // Calculate overall system status
    const criticalAlerts = health.alerts.filter(alert => alert.includes('🚨')).length
    const warningAlerts = health.alerts.filter(alert => alert.includes('⚠️')).length
    
    let systemStatus = 'healthy'
    if (criticalAlerts > 0) {
      systemStatus = 'critical'
    } else if (warningAlerts > 1) {
      systemStatus = 'warning'
    } else if (health.alerts.length > 0) {
      systemStatus = 'attention'
    }

    console.log(`📊 System health check completed: ${systemStatus}`)
    console.log(`- Alerts: ${health.alerts.length}`)
    console.log(`- Recommendations: ${health.recommendations.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        system_status: systemStatus,
        health,
        timestamp: new Date().toISOString(),
        summary: {
          total_alerts: health.alerts.length,
          critical_alerts: criticalAlerts,
          warning_alerts: warningAlerts,
          total_recommendations: health.recommendations.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('System monitoring failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        system_status: 'error',
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})