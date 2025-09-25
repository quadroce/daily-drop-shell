import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
]

interface SourcePerformance {
  source_id: number
  name: string
  feed_url: string
  status: 'healthy' | 'slow' | 'problematic' | 'blocked'
  avg_response_time: number
  success_rate: number
  last_success: string | null
  error_pattern: string | null
  recommendation: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json().catch(() => ({}))
    const { action = 'analyze', source_ids = [] } = body

    console.log(`🔧 RSS Optimization - Action: ${action}`)

    if (action === 'analyze') {
      return await analyizeRSSPerformance(supabase)
    } else if (action === 'optimize') {
      return await optimizeProblematicFeeds(supabase, source_ids)
    } else if (action === 'test') {
      return await testFeedConnectivity(supabase, source_ids)
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: analyze, optimize, or test' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('RSS optimization failed:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function analyizeRSSPerformance(supabase: any) {
  console.log('📊 Analyzing RSS feed performance...')

  // Get all active sources
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, name, feed_url, status')
    .eq('status', 'active')
    .not('feed_url', 'is', null)

  if (sourcesError) throw sourcesError

  // Get source health data
  const { data: healthData, error: healthError } = await supabase
    .from('source_health')
    .select('*')

  if (healthError) throw healthError

  const healthMap = new Map(healthData?.map((h: any) => [h.source_id, h]) || [])

  // Get recent ingestion queue data for each source
  const { data: queueData, error: queueError } = await supabase
    .from('ingestion_queue')
    .select('source_id, status, error, tries, created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days

  if (queueError) throw queueError

  const queueBySource = new Map<number, any[]>()
  queueData?.forEach((item: any) => {
    if (!queueBySource.has(item.source_id)) {
      queueBySource.set(item.source_id, [])
    }
    queueBySource.get(item.source_id)!.push(item)
  })

  const analysis: SourcePerformance[] = []

  for (const source of sources || []) {
    const health = healthMap.get(source.id)
    const queueItems = queueBySource.get(source.id) || []
    
    const totalItems = queueItems.length
    const successfulItems = queueItems.filter(item => item.status === 'completed').length
    const errorItems = queueItems.filter(item => item.status === 'error').length
    
    const successRate = totalItems > 0 ? (successfulItems / totalItems) * 100 : 100
    
    // Determine status
    let status: SourcePerformance['status'] = 'healthy'
    let recommendation = 'Source is performing well'
    
    if ((health as any)?.is_paused) {
      status = 'blocked'
      recommendation = 'Source is paused due to errors - needs manual review'
    } else if (successRate < 50) {
      status = 'problematic'
      recommendation = 'High error rate - consider updating feed URL or pausing'
    } else if (successRate < 80) {
      status = 'slow'
      recommendation = 'Moderate issues - monitor and consider rate limiting'
    }

    // Analyze error patterns
    let errorPattern: string | null = null
    const errors = queueItems.filter(item => item.error).map(item => item.error)
    if (errors.length > 0) {
      const errorCounts = new Map<string, number>()
      errors.forEach(error => {
        const pattern = error.includes('403') ? '403_forbidden' :
                        error.includes('404') ? '404_not_found' :
                        error.includes('429') ? '429_rate_limit' :
                        error.includes('timeout') ? 'timeout' :
                        error.includes('ssl') || error.includes('certificate') ? 'ssl_error' :
                        'other'
        errorCounts.set(pattern, (errorCounts.get(pattern) || 0) + 1)
      })
      
      const mostCommonError = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]
      errorPattern = `${mostCommonError[0]} (${mostCommonError[1]} times)`
    }

    analysis.push({
      source_id: source.id,
      name: source.name,
      feed_url: source.feed_url,
      status,
      avg_response_time: 0, // We don't track this yet
      success_rate: Math.round(successRate),
      last_success: (health as any)?.last_success_at || null,
      error_pattern: errorPattern,
      recommendation
    })
  }

  // Sort by status priority (problematic first)
  analysis.sort((a, b) => {
    const statusPriority = { 'blocked': 0, 'problematic': 1, 'slow': 2, 'healthy': 3 }
    return statusPriority[a.status] - statusPriority[b.status]
  })

  const summary = {
    total_sources: analysis.length,
    healthy: analysis.filter(s => s.status === 'healthy').length,
    slow: analysis.filter(s => s.status === 'slow').length,
    problematic: analysis.filter(s => s.status === 'problematic').length,
    blocked: analysis.filter(s => s.status === 'blocked').length
  }

  console.log(`📊 Analysis complete: ${summary.total_sources} sources analyzed`)
  console.log(`- Healthy: ${summary.healthy}, Slow: ${summary.slow}, Problematic: ${summary.problematic}, Blocked: ${summary.blocked}`)

  return new Response(
    JSON.stringify({
      success: true,
      analysis,
      summary,
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function optimizeProblematicFeeds(supabase: any, sourceIds: number[]) {
  console.log(`🔧 Optimizing ${sourceIds.length} problematic feeds...`)

  const optimizations = []

  for (const sourceId of sourceIds) {
    try {
      // Get source details
      const { data: source } = await supabase
        .from('sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (!source) continue

      // Update source health with optimization flags
      const { error: healthError } = await supabase
        .from('source_health')
        .upsert({
          source_id: sourceId,
          consecutive_errors: 0, // Reset error count
          is_paused: false, // Unpause if paused
          paused_until: null,
          last_success_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (healthError) {
        console.error(`Failed to optimize source ${sourceId}:`, healthError)
        optimizations.push({
          source_id: sourceId,
          status: 'failed',
          error: healthError.message
        })
        continue
      }

      // Clear problematic queue items for this source
      const { error: queueError } = await supabase
        .from('ingestion_queue')
        .delete()
        .eq('source_id', sourceId)
        .gte('tries', 3)

      if (queueError) {
        console.warn(`Failed to clear queue for source ${sourceId}:`, queueError)
      }

      optimizations.push({
        source_id: sourceId,
        source_name: source.name,
        status: 'optimized',
        actions: ['reset_error_count', 'unpaused_source', 'cleared_failed_queue']
      })

      console.log(`✅ Optimized source ${sourceId}: ${source.name}`)

    } catch (error) {
      console.error(`Error optimizing source ${sourceId}:`, error)
      optimizations.push({
        source_id: sourceId,
        status: 'failed',
        error: String(error)
      })
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Optimized ${optimizations.filter(o => o.status === 'optimized').length} sources`,
      optimizations,
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}

async function testFeedConnectivity(supabase: any, sourceIds: number[]) {
  console.log(`🧪 Testing connectivity for ${sourceIds.length} feeds...`)

  const results = []

  for (const sourceId of sourceIds) {
    try {
      // Get source details
      const { data: source } = await supabase
        .from('sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (!source || !source.feed_url) {
        results.push({
          source_id: sourceId,
          status: 'failed',
          error: 'Source not found or missing feed URL'
        })
        continue
      }

      // Test connectivity with random User-Agent
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      const startTime = Date.now()

      const response = await fetch(source.feed_url, {
        method: 'HEAD', // Just check headers, don't download content
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'Cache-Control': 'no-cache'
        }
      })

      const responseTime = Date.now() - startTime

      results.push({
        source_id: sourceId,
        source_name: source.name,
        feed_url: source.feed_url,
        status: response.ok ? 'healthy' : 'error',
        http_status: response.status,
        response_time_ms: responseTime,
        content_type: response.headers.get('content-type'),
        user_agent_used: userAgent
      })

      console.log(`📡 Source ${sourceId}: ${response.status} (${responseTime}ms)`)

    } catch (error) {
      results.push({
        source_id: sourceId,
        status: 'failed',
        error: String(error)
      })
      console.error(`❌ Source ${sourceId} test failed:`, error)
    }

    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  const summary = {
    total_tested: results.length,
    healthy: results.filter(r => r.status === 'healthy').length,
    errors: results.filter(r => r.status === 'error').length,
    failed: results.filter(r => r.status === 'failed').length,
    avg_response_time: Math.round(
      results
        .filter(r => r.response_time_ms !== undefined)
        .reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / 
      Math.max(1, results.filter(r => r.response_time_ms !== undefined).length)
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      results,
      summary,
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  )
}