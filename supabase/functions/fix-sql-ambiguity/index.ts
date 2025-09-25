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

    console.log('🔧 Starting SQL ambiguity fix...')

    // Identifica i drops con errori di query ambigue
    const { data: problematicDrops, error: queryError } = await supabase
      .from('drops')
      .select(`
        id, title, l1_topic_id, l2_topic_id, tags, 
        url, published_at, created_at, tag_done
      `)
      .eq('tag_done', false)
      .or('l1_topic_id.is.null,l2_topic_id.is.null')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (queryError) {
      console.error('Error fetching problematic drops:', queryError)
      throw queryError
    }

    console.log(`Found ${problematicDrops?.length || 0} drops needing SQL fix`)

    if (!problematicDrops || problematicDrops.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No problematic drops found',
          fixed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    let fixedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Process drops in batches
    const BATCH_SIZE = 50
    for (let i = 0; i < problematicDrops.length; i += BATCH_SIZE) {
      const batch = problematicDrops.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(problematicDrops.length/BATCH_SIZE)}`)

      for (const drop of batch) {
        try {
          // Call tag-drops function to properly reprocess this drop
          const { data: tagResult, error: tagError } = await supabase.functions.invoke('tag-drops', {
            body: { 
              drop_ids: [drop.id],
              force_retag: true,
              max_l3: 3
            }
          })

          if (tagError) {
            console.error(`Error retagging drop ${drop.id}:`, tagError)
            errors.push(`Drop ${drop.id}: ${tagError.message}`)
            errorCount++
          } else {
            console.log(`✅ Fixed drop ${drop.id}: ${drop.title?.substring(0, 50)}...`)
            fixedCount++
          }
        } catch (err) {
          console.error(`Exception processing drop ${drop.id}:`, err)
          errors.push(`Drop ${drop.id}: ${String(err)}`)
          errorCount++
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + BATCH_SIZE < problematicDrops.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`✅ SQL Fix completed: ${fixedCount} fixed, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully fixed ${fixedCount} drops with SQL ambiguity issues`,
        fixed: fixedCount,
        errors: errorCount,
        error_details: errors.slice(0, 10) // First 10 errors for debugging
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('SQL fix failed:', error)
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