import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') return false
  
  // Check if URL contains JSON-like content (starts with array/object)
  if (url.startsWith('[') || url.startsWith('{')) return false
  
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔍 Validating URLs in ingestion queue...')

    // Find items with invalid URLs
    const { data: queueItems, error: fetchError } = await supabase
      .from('ingestion_queue')
      .select('*')
      .in('status', ['pending', 'retry', 'error'])

    if (fetchError) {
      console.error('Error fetching queue items:', fetchError)
      throw fetchError
    }

    const invalidItems = queueItems?.filter(item => !isValidUrl(item.url)) || []
    
    console.log(`Found ${queueItems?.length || 0} items in queue, ${invalidItems.length} with invalid URLs`)

    if (invalidItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No invalid URLs found',
          validated: queueItems?.length || 0,
          removed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Delete items with invalid URLs
    const itemIds = invalidItems.map(item => item.id)
    
    const { error: deleteError } = await supabase
      .from('ingestion_queue')
      .delete()
      .in('id', itemIds)

    if (deleteError) {
      console.error('Error deleting invalid items:', deleteError)
      throw deleteError
    }

    console.log(`✅ Successfully deleted ${itemIds.length} items with invalid URLs`)

    // Log details of deleted items
    invalidItems.forEach(item => {
      console.log(`Deleted invalid URL: ${item.url?.substring(0, 200)}...`)
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully removed ${itemIds.length} items with invalid URLs`,
        validated: queueItems?.length || 0,
        removed: itemIds.length,
        examples: invalidItems.slice(0, 3).map(item => ({
          id: item.id,
          url: item.url?.substring(0, 100) + '...',
          source_id: item.source_id
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('URL validation failed:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})