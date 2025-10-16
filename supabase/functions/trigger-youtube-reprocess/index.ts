import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Triggering YouTube bulk reprocessing...');

    // Call bulk-reprocess-youtube with a batch of 50 videos
    const { data, error } = await supabase.functions.invoke('bulk-reprocess-youtube', {
      body: { 
        batchSize: 50,
        startFromId: 0,
        dryRun: false
      }
    });

    if (error) {
      throw error;
    }

    console.log('✅ Reprocessing started:', data);

    return new Response(JSON.stringify({
      success: true,
      message: 'YouTube reprocessing batch started',
      result: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Trigger error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
