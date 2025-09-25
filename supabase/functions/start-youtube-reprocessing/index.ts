import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting YouTube reprocessing workflow...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get total count of problematic videos
    const { count: totalProblematic } = await supabase
      .from('drops')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'video')
      .like('url', '%youtube.com%')
      .or(`title.like.- YouTube%,youtube_video_id.is.null`);
    
    console.log(`Found ${totalProblematic} problematic YouTube videos`);
    
    if (!totalProblematic || totalProblematic === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No problematic YouTube videos found',
        totalProblematic: 0,
        batchesNeeded: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Calculate how many batches we'll need (20 videos per batch)
    const batchSize = 20;
    const batchesNeeded = Math.ceil(totalProblematic / batchSize);
    
    console.log(`Will need ${batchesNeeded} batches to process all videos`);
    
    // Start the first batch
    console.log('Starting first batch...');
    const { data: firstBatchResult, error: firstBatchError } = await supabase.functions.invoke('bulk-reprocess-youtube', {
      body: { 
        batchSize: batchSize,
        startFromId: 0,
        dryRun: false
      }
    });
    
    if (firstBatchError) {
      throw new Error(`First batch failed: ${firstBatchError.message}`);
    }
    
    console.log('First batch result:', firstBatchResult);
    
    const response = {
      success: true,
      message: 'YouTube reprocessing started successfully',
      totalProblematic,
      batchSize,
      batchesNeeded,
      firstBatchResult,
      instructions: {
        manual: 'To continue processing, call the bulk-reprocess-youtube function with startFromId parameter',
        automatic: 'This could be automated with a cron job',
        nextBatchStartId: firstBatchResult?.lastProcessedId || 0
      }
    };
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
    } catch (error) {
      console.error('Failed to start YouTube reprocessing:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});