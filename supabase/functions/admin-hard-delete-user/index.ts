import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
};

interface DeleteUserRequest {
  user_id: string;
  force?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Anonymous client for JWT validation
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Service role client for database operations (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller using anonymous client
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      console.log('User validation error:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if caller has superadmin role using service client
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'superadmin') {
      console.log(`Access denied: user ${user.id} has role ${callerProfile?.role}, requires superadmin. Error:`, profileError);
      return new Response(JSON.stringify({ error: 'Only SuperAdmin can perform hard deletes' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, force = false }: DeleteUserRequest = await req.json();
    
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting hard delete for user ${user_id} by ${user.id}, force=${force}`);

    // Check if user exists and get their profile using service client
    const { data: targetProfile } = await serviceClient
      .from('profiles')
      .select('email, subscription_tier, role')
      .eq('id', user_id)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety check: block deletion of active corporate/sponsor users unless forced
    if (!force && ['sponsor', 'corporate'].includes(targetProfile.subscription_tier)) {
      console.log(`Blocked deletion of ${targetProfile.subscription_tier} user ${user_id} without force flag`);
      return new Response(JSON.stringify({ 
        error: 'Cannot delete sponsor/corporate users without force flag',
        requires_force: true 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Start transaction-like cleanup
    console.log('Starting cascading cleanup...');
    
    try {
      // Delete user-related data in dependency order
      const cleanupTables = [
        'user_topic_preferences',
        'user_profile_vectors', 
        'newsletter_subscriptions',
        'whatsapp_subscriptions',
        'engagement_events',
        'delivery_log',
        'bookmarks',
        'daily_batch_items', // Will cascade from daily_batches
        'daily_batches',
        'preferences',
        // Add other user-related tables as needed
      ];

      for (const table of cleanupTables) {
        const { error: deleteError } = await serviceClient
          .from(table)
          .delete()
          .eq('user_id', user_id);
        
        if (deleteError) {
          console.error(`Error deleting from ${table}:`, deleteError);
          // Continue with other tables - some might not exist or have different structure
        } else {
          console.log(`Cleaned up ${table} for user ${user_id}`);
        }
      }

      // Log the action for audit trail BEFORE deleting the profile
      // This prevents foreign key constraint violations
      const { error: auditError } = await serviceClient
        .from('admin_audit_log')
        .insert({
          user_id: user.id,
          action: 'hard_delete_user',
          resource_type: 'user',
          resource_id: user_id,
          details: {
            target_email: targetProfile.email,
            target_role: targetProfile.role,
            target_tier: targetProfile.subscription_tier,
            forced: force,
            timestamp: new Date().toISOString()
          }
        });

      if (auditError) {
        console.error('Error logging audit action:', auditError);
        // Don't fail the entire operation for audit log errors
      }

      // Delete all historical audit records for this user to prevent FK constraint violations
      const { error: auditCleanupError } = await serviceClient
        .from('admin_audit_log')
        .delete()
        .eq('user_id', user_id);

      if (auditCleanupError) {
        console.error('Error cleaning up audit records:', auditCleanupError);
        // Continue with deletion even if audit cleanup fails
      } else {
        console.log(`Cleaned up historical audit records for user ${user_id}`);
      }

      // Delete from profiles table (this should cascade to other tables with FK constraints)
      const { error: profileError } = await serviceClient
        .from('profiles')
        .delete()
        .eq('id', user_id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw profileError;
      }

      // Finally, delete from auth.users (this is the nuclear option)
      const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(user_id);
      
      if (authDeleteError) {
        console.error('Error deleting from auth.users:', authDeleteError);
        throw authDeleteError;
      }

      console.log(`Successfully hard deleted user ${user_id}`);

      return new Response(JSON.stringify({ 
        success: true,
        message: `User ${targetProfile.email} has been permanently deleted`,
        deleted_user_id: user_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
      const errorMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      return new Response(JSON.stringify({ 
        error: 'Failed to complete user deletion',
        details: errorMessage 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in hard delete function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});