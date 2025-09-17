import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function processEmbeddings(sinceMinutes = 120) {
  console.log(`🧠 Processing embeddings for drops from last ${sinceMinutes} minutes...`);
  
  try {
    const { data, error } = await supabase.functions.invoke('embed-drops', {
      body: { since_minutes: sinceMinutes }
    });

    if (error) {
      throw error;
    }

    console.log(`✅ Embeddings processed successfully:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Failed to process embeddings:`, error);
    throw error;
  }
}

async function refreshAllUserProfiles() {
  console.log(`👥 Refreshing all user profile vectors...`);
  
  try {
    // Get all users with recent engagement events
    const { data: users, error: usersError } = await supabase
      .from('engagement_events')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .not('user_id', 'is', null);

    if (usersError) {
      throw usersError;
    }

    // Get unique user IDs and filter out any null/undefined values
    const uniqueUserIds = [...new Set(
      users?.map(u => u.user_id)
        .filter(id => id !== null && id !== undefined && id !== '') || []
    )];
    console.log(`Found ${uniqueUserIds.length} users with recent engagement to refresh`);

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        const { data, error } = await supabase.functions.invoke('refresh-user-profile', {
          body: { user_id: userId }
        });

        if (error) {
          throw error;
        }

        successful++;
        console.log(`✅ Refreshed profile for user ${userId}`);
      } catch (error) {
        failed++;
        const errorMsg = `Failed to refresh user ${userId}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = {
      total_users: uniqueUserIds.length,
      successful,
      failed,
      errors
    };

    console.log(`✅ Profile refresh completed:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Failed to refresh user profiles:`, error);
    throw error;
  }
}

async function getEmbeddingStats() {
  try {
    // Get total drops count
    const { count: totalDrops, error: totalError } = await supabase
      .from('drops')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Get drops with embeddings
    const { count: embeddedDrops, error: embeddedError } = await supabase
      .from('drops')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (embeddedError) throw embeddedError;

    // Get user profiles count
    const { count: totalProfiles, error: profilesError } = await supabase
      .from('user_profile_vectors')
      .select('*', { count: 'exact', head: true });

    if (profilesError) throw profilesError;

    return {
      total_drops: totalDrops || 0,
      embedded_drops: embeddedDrops || 0,
      missing_embeddings: (totalDrops || 0) - (embeddedDrops || 0),
      embedding_percentage: totalDrops ? Math.round(((embeddedDrops || 0) / totalDrops) * 100) : 0,
      user_profiles: totalProfiles || 0
    };
  } catch (error) {
    console.error('Failed to get embedding stats:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, since_minutes } = await req.json().catch(() => ({ action: 'embeddings' }));
    
    console.log(`🚀 Automated embeddings triggered: ${action}`);

    let result;

    switch (action) {
      case 'embeddings':
        result = await processEmbeddings(since_minutes || 120);
        break;
        
      case 'profiles':
        result = await refreshAllUserProfiles();
        break;
        
      case 'backlog':
        // Process large backlog in chunks
        console.log('🔄 Processing embedding backlog...');
        result = await processEmbeddings(30 * 24 * 60); // Last 30 days
        break;
        
      case 'stats':
        result = await getEmbeddingStats();
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        result,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('🚨 Automated embeddings error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});