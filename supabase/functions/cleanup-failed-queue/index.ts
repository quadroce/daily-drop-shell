import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🧹 Starting cleanup of failed queue items...')

    // Find items that have failed too many times (>= 5 tries)
    const { data: failedItems, error: fetchError } = await supabase
      .from('ingestion_queue')
      .select('*')
      .gte('tries', 5)
      .in('status', ['pending', 'retry'])

    if (fetchError) {
      console.error('Error fetching failed items:', fetchError)
      throw fetchError
    }

    console.log(`Found ${failedItems?.length || 0} items with >= 5 tries`)

    // Also find items with malformed URLs (containing JSON-like content)
    const { data: malformedItems, error: malformedError } = await supabase
      .from('ingestion_queue')
      .select('*')
      .like('url', '%{%')  // URLs containing curly braces are likely malformed JSON

    if (malformedError) {
      console.error('Error fetching malformed items:', malformedError)
      throw malformedError
    }

    console.log(`Found ${malformedItems?.length || 0} items with malformed URLs`)

    // Combine both arrays and remove duplicates
    const allProblematicItems = [
      ...(failedItems || []),
      ...(malformedItems || [])
    ].filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    )

    console.log(`Total problematic items to clean: ${allProblematicItems.length}`)

    if (allProblematicItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No problematic items found',
          cleaned: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Delete them definitively instead of just marking as failed
    const itemIds = allProblematicItems.map(item => item.id)
    
    const { error: deleteError } = await supabase
      .from('ingestion_queue')
      .delete()
      .in('id', itemIds)

    if (deleteError) {
      console.error('Error deleting failed items:', deleteError)
      throw deleteError
    }

    console.log(`✅ Successfully deleted ${itemIds.length} problematic items`)

    // Log details of deleted items for debugging
    allProblematicItems.forEach(item => {
      console.log(`Deleted item ${item.id}: ${item.url?.substring(0, 100)}... (tries: ${item.tries})`)
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted ${itemIds.length} problematic queue items`,
        deleted: itemIds.length,
        items: allProblematicItems.map(item => ({
          id: item.id,
          url: item.url?.substring(0, 100) + '...',
          tries: item.tries,
          status: item.status
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Cleanup failed:', error)
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