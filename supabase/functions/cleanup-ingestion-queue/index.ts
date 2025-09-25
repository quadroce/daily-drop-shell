import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Blacklist di domini problematici che ritornano sempre errori
const DOMAIN_BLACKLIST = [
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
  'amazon.com', 'ebay.com', 'aliexpress.com', 'booking.com',
  'netflix.com', 'spotify.com', 'youtube.com/watch', 'youtu.be',
  'accounts.google.com', 'login.microsoft.com', 'auth0.com'
]

const PERMANENT_ERROR_CODES = [
  '403', '404', '410', '451', // Client errors that won't resolve
  'timeout', 'dns', 'certificate', 'ssl' // Infrastructure errors
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🧹 Starting intelligent queue cleanup...')

    // Step 1: Find items with permanent errors (5+ tries)
    const { data: failedItems, error: fetchError } = await supabase
      .from('ingestion_queue')
      .select('*')
      .gte('tries', 5)
      .in('status', ['pending', 'retry', 'error'])

    if (fetchError) {
      console.error('Error fetching failed items:', fetchError)
      throw fetchError
    }

    console.log(`Found ${failedItems?.length || 0} items with 5+ failed attempts`)

    // Step 2: Find items with blacklisted domains
    const { data: allPendingItems, error: allItemsError } = await supabase
      .from('ingestion_queue')
      .select('*')
      .in('status', ['pending', 'retry', 'error'])
      .limit(5000)

    if (allItemsError) {
      console.error('Error fetching all items:', allItemsError)
      throw allItemsError
    }

    // Filter blacklisted URLs
    const blacklistedItems = (allPendingItems || []).filter(item => {
      if (!item.url) return false
      
      try {
        const url = new URL(item.url)
        const domain = url.hostname.toLowerCase()
        
        return DOMAIN_BLACKLIST.some(blacklistedDomain => 
          domain.includes(blacklistedDomain) || domain.endsWith(blacklistedDomain)
        )
      } catch {
        return true // Invalid URLs should be removed
      }
    })

    // Step 3: Find items with permanent error patterns
    const permanentErrorItems = (allPendingItems || []).filter(item => {
      if (!item.error) return false
      
      const errorLower = item.error.toLowerCase()
      return PERMANENT_ERROR_CODES.some(code => errorLower.includes(code))
    })

    // Step 4: Find malformed URLs (containing JSON-like content)
    const malformedItems = (allPendingItems || []).filter(item => {
      if (!item.url) return true
      
      // Check for JSON-like content in URL
      return item.url.includes('{') || item.url.includes('}') || 
             item.url.includes('undefined') || item.url.includes('null') ||
             item.url.length > 2000 // Suspiciously long URLs
    })

    // Combine all problematic items and remove duplicates
    const allProblematicItems = [
      ...(failedItems || []),
      ...blacklistedItems,
      ...permanentErrorItems,
      ...malformedItems
    ].filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    )

    console.log(`Categories found:`)
    console.log(`- Failed items (5+ tries): ${failedItems?.length || 0}`)
    console.log(`- Blacklisted domains: ${blacklistedItems.length}`)
    console.log(`- Permanent errors: ${permanentErrorItems.length}`)
    console.log(`- Malformed URLs: ${malformedItems.length}`)
    console.log(`- Total unique problematic items: ${allProblematicItems.length}`)

    if (allProblematicItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No problematic items found in queue',
          cleaned: 0,
          stats: {
            failed_items: 0,
            blacklisted: 0,
            permanent_errors: 0,
            malformed: 0
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Step 5: Delete problematic items in batches
    const BATCH_SIZE = 100
    let deletedCount = 0
    
    for (let i = 0; i < allProblematicItems.length; i += BATCH_SIZE) {
      const batch = allProblematicItems.slice(i, i + BATCH_SIZE)
      const itemIds = batch.map(item => item.id)
      
      const { error: deleteError } = await supabase
        .from('ingestion_queue')
        .delete()
        .in('id', itemIds)

      if (deleteError) {
        console.error(`Error deleting batch starting at ${i}:`, deleteError)
        throw deleteError
      }

      deletedCount += batch.length
      console.log(`Deleted batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allProblematicItems.length/BATCH_SIZE)} (${batch.length} items)`)
    }

    // Step 6: Update source health for problematic sources
    const sourceIds = [...new Set(allProblematicItems.map(item => item.source_id).filter(Boolean))]
    if (sourceIds.length > 0) {
      console.log(`Updating health status for ${sourceIds.length} problematic sources`)
      
      for (const sourceId of sourceIds) {
        await supabase
          .from('source_health')
          .upsert({
            source_id: sourceId,
            consecutive_errors: 5,
            error_type: 'queue_cleanup',
            last_error_at: new Date().toISOString(),
            is_paused: true,
            paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Pause for 24 hours
          })
      }
    }

    console.log(`✅ Queue cleanup completed: ${deletedCount} items removed, ${sourceIds.length} sources paused`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully cleaned ${deletedCount} problematic queue items`,
        cleaned: deletedCount,
        stats: {
          failed_items: failedItems?.length || 0,
          blacklisted: blacklistedItems.length,
          permanent_errors: permanentErrorItems.length,
          malformed: malformedItems.length
        },
        sources_paused: sourceIds.length,
        sample_deleted: allProblematicItems.slice(0, 5).map(item => ({
          id: item.id,
          url: item.url?.substring(0, 100) + '...',
          tries: item.tries,
          error: item.error?.substring(0, 100) + '...'
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Queue cleanup failed:', error)
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