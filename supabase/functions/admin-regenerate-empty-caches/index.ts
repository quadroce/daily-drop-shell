import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Only allow admin users to trigger cache regeneration
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin access
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', (await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))).data.user?.id)
      .single();

    if (profileError || !profile || !['admin', 'superadmin'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Admin Cache Regen] Starting cache regeneration for empty caches...');

    // Find users with no valid cache entries
    const currentTime = new Date().toISOString();
    const { data: usersWithEmptyCache, error: usersError } = await supabaseClient.rpc('sql', {
      sql: `
        SELECT DISTINCT p.user_id
        FROM preferences p
        LEFT JOIN user_feed_cache ufc ON ufc.user_id = p.user_id 
          AND ufc.expires_at > $1
        WHERE p.selected_topic_ids IS NOT NULL 
          AND p.selected_topic_ids != '{}'
          AND (ufc.user_id IS NULL OR (
            SELECT COUNT(*) 
            FROM user_feed_cache 
            WHERE user_id = p.user_id 
            AND expires_at > $1
          ) < 5)
        ORDER BY p.user_id
        LIMIT 50
      `,
      params: [currentTime]
    });

    if (usersError) {
      console.error('[Admin Cache Regen] Error finding users with empty cache:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to find users with empty cache' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!usersWithEmptyCache || usersWithEmptyCache.length === 0) {
      console.log('[Admin Cache Regen] No users found with empty cache');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users found with empty cache',
          users_processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Admin Cache Regen] Found ${usersWithEmptyCache.length} users with empty/insufficient cache`);

    // Call background-feed-ranking with smart cache for these specific users
    const userIds = usersWithEmptyCache.map((u: any) => u.user_id);
    
    const { data: regenerationResult, error: regenError } = await supabaseClient.functions.invoke(
      'background-feed-ranking',
      {
        body: {
          trigger: 'admin_regeneration',
          user_ids: userIds,
          smart_cache: true,
          force_regeneration: false // Use smart cache logic
        }
      }
    );

    if (regenError) {
      console.error('[Admin Cache Regen] Error calling background-feed-ranking:', regenError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to regenerate caches',
          details: regenError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Admin Cache Regen] Cache regeneration completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cache regeneration completed for users with empty cache',
        users_found: usersWithEmptyCache.length,
        regeneration_result: regenerationResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Admin Cache Regen] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});