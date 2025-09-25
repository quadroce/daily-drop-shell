import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { env } from "../_shared/env.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const supabaseKey = env('SUPABASE_SERVICE_ROLE_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    const payload = await req.json()

    console.log('Received GitHub webhook:', payload)

    // Extract workflow run information
    const { action, workflow_run } = payload
    
    if (action !== 'completed') {
      console.log('Ignoring non-completed workflow run')
      return new Response(JSON.stringify({ message: 'Ignored non-completed action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse run_id from workflow inputs if available
    let runId: number | null = null
    if (workflow_run?.head_commit?.message?.includes('[run_id:')) {
      const match = workflow_run.head_commit.message.match(/\[run_id:(\d+)\]/)
      if (match) {
        runId = parseInt(match[1])
      }
    }

    // Calculate statistics from generated files
    let totalUrls = 0
    let topicsCount = 0
    let archiveUrlsCount = 0

    try {
      // Fetch and parse sitemap files to get accurate counts
      const sitemapResponse = await fetch('https://dailydrops.cloud/sitemap.xml')
      if (sitemapResponse.ok) {
        const sitemapContent = await sitemapResponse.text()
        // Count sitemap entries (rough estimate)
        const sitemapEntries = (sitemapContent.match(/<sitemap>/g) || []).length
        totalUrls += sitemapEntries
      }

      const topicsResponse = await fetch('https://dailydrops.cloud/sitemap-topics.xml')
      if (topicsResponse.ok) {
        const topicsContent = await topicsResponse.text()
        topicsCount = (topicsContent.match(/<url>/g) || []).length
        totalUrls += topicsCount
      }

      const archivesResponse = await fetch('https://dailydrops.cloud/sitemap-archives.xml')
      if (archivesResponse.ok) {
        const archivesContent = await archivesResponse.text()
        archiveUrlsCount = (archivesContent.match(/<url>/g) || []).length
        totalUrls += archiveUrlsCount
      }
    } catch (error) {
      console.error('Error fetching sitemap files for stats:', error)
    }

    const success = workflow_run?.conclusion === 'success'
    const errorMessage = success ? null : `Workflow failed: ${workflow_run?.conclusion}`

    // Update the most recent sitemap run or create a new one if runId not found
    if (runId) {
      const { error: updateError } = await supabase
        .from('sitemap_runs')
        .update({
          completed_at: new Date().toISOString(),
          success,
          error_message: errorMessage,
          total_urls: totalUrls,
          topics_count: topicsCount,
          archive_urls_count: archiveUrlsCount,
          google_ping_success: success, // Assume success if workflow succeeded
          bing_ping_success: success
        })
        .eq('id', runId)

      if (updateError) {
        console.error('Error updating sitemap run:', updateError)
      } else {
        console.log('Updated sitemap run:', runId)
      }
    } else {
      // Fallback: update the most recent incomplete run
      const { error: updateError } = await supabase
        .from('sitemap_runs')
        .update({
          completed_at: new Date().toISOString(),
          success,
          error_message: errorMessage,
          total_urls: totalUrls,
          topics_count: topicsCount,
          archive_urls_count: archiveUrlsCount,
          google_ping_success: success,
          bing_ping_success: success
        })
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(1)

      if (updateError) {
        console.error('Error updating latest sitemap run:', updateError)
      } else {
        console.log('Updated latest incomplete sitemap run')
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed',
        workflow_success: success,
        total_urls: totalUrls
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sitemap-webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})