import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting retroactive retagging process...');

    // Find all drops missing L1 or L2 topics
    const { data: dropsToRetag, error: queryError } = await supabase
      .from('drops')
      .select('id, title, l1_topic_id, l2_topic_id')
      .or('l1_topic_id.is.null,l2_topic_id.is.null')
      .order('created_at', { ascending: false })
      .limit(1000); // Process in batches of 1000

    if (queryError) {
      console.error('Error querying drops:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query drops', details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dropsToRetag || dropsToRetag.length === 0) {
      console.log('No drops found that need retagging');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No drops need retagging', 
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${dropsToRetag.length} drops that need retagging`);

    // Process drops in smaller batches to avoid timeouts
    const batchSize = 50;
    const results = [];
    let totalProcessed = 0;

    for (let i = 0; i < dropsToRetag.length; i += batchSize) {
      const batch = dropsToRetag.slice(i, i + batchSize);
      const dropIds = batch.map(d => d.id);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${dropIds.length} drops`);

      try {
        // Call tag-drops function for this batch
        const { data, error } = await supabase.functions.invoke('tag-drops', {
          body: {
            drop_ids: dropIds,
            force_retag: true,
            max_l3: 3
          },
          headers: {
            Authorization: authHeader,
          }
        });

        if (error) {
          console.error(`Error processing batch starting at index ${i}:`, error);
          results.push({
            batch: Math.floor(i / batchSize) + 1,
            error: error.message || error,
            drop_ids: dropIds
          });
        } else {
          console.log(`Successfully processed batch ${Math.floor(i / batchSize) + 1}:`, data);
          results.push({
            batch: Math.floor(i / batchSize) + 1,
            success: true,
            processed: data?.processed || dropIds.length,
            drop_ids: dropIds
          });
          totalProcessed += data?.processed || dropIds.length;
        }
      } catch (batchError) {
        console.error(`Exception processing batch starting at index ${i}:`, batchError);
        const batchErrorObj = batchError instanceof Error ? batchError : new Error(String(batchError));
        results.push({
          batch: Math.floor(i / batchSize) + 1,
          error: batchErrorObj.message,
          drop_ids: dropIds
        });
      }

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Retroactive retagging completed. Total processed: ${totalProcessed}/${dropsToRetag.length}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total_found: dropsToRetag.length,
        total_processed: totalProcessed,
        batches_processed: results.length,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retag-missing-topics:', error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorObj.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});