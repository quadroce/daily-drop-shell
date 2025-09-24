import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`[Manual] Regenerating cache for user: ${user_id}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Clear existing cache
    await supabaseClient
      .from('user_feed_cache')
      .delete()
      .eq('user_id', user_id);

    console.log(`[Manual] Cleared existing cache for user: ${user_id}`);

    // Call background-feed-ranking for this specific user
    const { data, error } = await supabaseClient.functions.invoke('background-feed-ranking', {
      body: { 
        trigger: 'manual_user', 
        user_id: user_id 
      }
    });

    if (error) {
      console.error('[Manual] Background ranking error:', error);
      throw error;
    }

    console.log('[Manual] Background ranking result:', data);

    // Check final cache count
    const { count } = await supabaseClient
      .from('user_feed_cache')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        cache_items: count || 0,
        background_result: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Manual] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to regenerate user cache',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});