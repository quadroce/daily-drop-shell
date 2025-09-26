import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminToolRequest {
  action: 'test_newsletter' | 'regenerate_cache' | 'check_cache' | 'fix_users';
  userId?: string;
  userIds?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { action, userId, userIds }: AdminToolRequest = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Newsletter admin action: ${action}`);

    switch (action) {
      case 'check_cache': {
        if (!userId) {
          throw new Error('userId required for check_cache');
        }

        // Check user feed cache
        const { data: cacheItems, error: cacheError } = await supabase
          .from('user_feed_cache')
          .select(`
            created_at, expires_at, position, final_score,
            drops!inner(id, title, published_at, created_at)
          `)
          .eq('user_id', userId)
          .order('position', { ascending: true });

        // Check user preferences
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('email, display_name, onboarding_completed, subscription_tier')
          .eq('id', userId)
          .single();

        const { data: preferences } = await supabase
          .from('preferences')
          .select('selected_topic_ids, selected_language_ids')
          .eq('user_id', userId)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            success: true,
            user: userProfile,
            preferences,
            cache: {
              items: cacheItems || [],
              count: cacheItems?.length || 0,
              hasValidCache: cacheItems && cacheItems.length > 0,
              error: cacheError?.message
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'regenerate_cache': {
        if (!userId) {
          throw new Error('userId required for regenerate_cache');
        }

        console.log(`Regenerating cache for user ${userId}`);

        // Trigger background feed ranking for specific user
        const { data: rankingResult, error: rankingError } = await supabase.functions.invoke(
          'background-feed-ranking',
          {
            body: {
              trigger: 'manual_regeneration',
              user_id: userId
            }
          }
        );

        if (rankingError) {
          console.error('Error triggering background ranking:', rankingError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Cache regeneration triggered for user ${userId}`,
            rankingResult,
            error: rankingError?.message
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'test_newsletter': {
        if (!userId) {
          throw new Error('userId required for test_newsletter');
        }

        console.log(`Testing newsletter for user ${userId}`);

        // 1. Build digest with corrected logic
        const { data: digestResult, error: digestError } = await supabase.functions.invoke(
          'build-digest',
          {
            body: {
              userId,
              cadence: 'daily',
              slot: 'morning',
              testMode: true
            }
          }
        );

        if (digestError) {
          console.error('Error building digest:', digestError);
          throw new Error(`Failed to build digest: ${digestError.message}`);
        }

        console.log('Digest built successfully:', {
          itemCount: digestResult?.itemCount,
          algorithmSource: digestResult?.algorithmSource
        });

        // 2. Send test email
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-email-digest',
          {
            body: {
              userId,
              digestContent: digestResult?.digestContent,
              testMode: true
            }
          }
        );

        if (emailError) {
          console.error('Error sending email:', emailError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Test newsletter processed for user ${userId}`,
            digest: {
              itemCount: digestResult?.itemCount,
              algorithmSource: digestResult?.algorithmSource,
              success: !digestError
            },
            email: {
              success: !emailError,
              error: emailError?.message
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'fix_users': {
        if (!userIds || userIds.length === 0) {
          throw new Error('userIds array required for fix_users');
        }

        console.log(`Fixing newsletter issues for ${userIds.length} users`);

        const results = [];

        for (const uid of userIds) {
          try {
            // 1. Check current cache status
            const { data: cacheCheck } = await supabase
              .from('user_feed_cache')
              .select('id')
              .eq('user_id', uid)
              .gt('expires_at', new Date().toISOString())
              .limit(1);

            // 2. Regenerate cache if needed
            if (!cacheCheck || cacheCheck.length === 0) {
              console.log(`Regenerating cache for user ${uid}`);
              await supabase.functions.invoke('background-feed-ranking', {
                body: { trigger: 'fix_users', user_id: uid }
              });
            }

            // 3. Test newsletter with corrected build-digest
            const { data: digestTest } = await supabase.functions.invoke('build-digest', {
              body: { userId: uid, cadence: 'daily', slot: 'morning', testMode: true }
            });

            results.push({
              userId: uid,
              cacheRegenerated: !cacheCheck || cacheCheck.length === 0,
              digestTest: {
                success: !!digestTest,
                itemCount: digestTest?.itemCount || 0,
                algorithmSource: digestTest?.algorithmSource
              }
            });

          } catch (error) {
            console.error(`Error processing user ${uid}:`, error);
            results.push({
              userId: uid,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Processed ${userIds.length} users`,
            results
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in newsletter-admin-tools:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});