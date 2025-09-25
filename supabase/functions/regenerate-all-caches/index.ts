import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    console.log('🚀 Starting cache regeneration for all active users...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active users with completed onboarding
    const { data: users, error: usersError } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .eq('is_active', true)
      .eq('onboarding_completed', true);

    if (usersError) {
      throw usersError;
    }

    console.log(`📊 Found ${users?.length || 0} active users to process`);

    const results = {
      total_users: users?.length || 0,
      processed: 0,
      errors: [] as string[],
    };

    // Process users in batches to avoid overwhelming the system
    const batchSize = 5;
    
    for (let i = 0; i < (users?.length || 0); i += batchSize) {
      const batch = users?.slice(i, i + batchSize) || [];
      
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil((users?.length || 0) / batchSize)}`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (user) => {
        try {
          console.log(`[${user.email}] Regenerating cache...`);
          
          // Clear existing cache
          await supabaseClient
            .from('user_feed_cache')
            .delete()
            .eq('user_id', user.id);

          // Call background-feed-ranking for this user
          const { data, error } = await supabaseClient.functions.invoke('background-feed-ranking', {
            body: { 
              trigger: 'manual_cache_regeneration', 
              user_id: user.id 
            }
          });

          if (error) {
            throw error;
          }

          console.log(`[${user.email}] ✅ Cache regenerated successfully`);
          return { user_id: user.id, success: true };
        } catch (error) {
          const errorMsg = `[${user.email}] Failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
          return { user_id: user.id, success: false, error: errorMsg };
        }
      });

      await Promise.all(batchPromises);
      results.processed += batch.length;
      
      // Wait between batches
      if (i + batchSize < (users?.length || 0)) {
        console.log('⏱️ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`🎉 Cache regeneration completed! Processed: ${results.processed}/${results.total_users}, Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cache regeneration completed',
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Cache regeneration failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to regenerate caches',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});