import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('admin-update-tags function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    console.log('Parsing request body...');
    const { dropId, topicIds } = await req.json();
    
    if (!dropId || !Array.isArray(topicIds)) {
      console.error('Invalid request parameters:', { dropId, topicIds });
      return new Response(
        JSON.stringify({ error: 'dropId and topicIds array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating tags for drop ${dropId} with topics:`, topicIds);

    // Check user authentication and role
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check user profile and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify user permissions', details: profileError.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User role:', profile?.role);

    if (!profile || !['editor', 'admin', 'superadmin'].includes(profile.role)) {
      console.error('User does not have required role. Current role:', profile?.role);
      return new Response(
        JSON.stringify({ 
          error: `Insufficient permissions. Current role: ${profile?.role}. Editor role or higher required.` 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the database function to update tags
    console.log('Calling admin_update_drop_tags function...');
    const { error } = await supabase.rpc('admin_update_drop_tags', {
      _drop_id: dropId,
      _topic_ids: topicIds
    });

    if (error) {
      console.error('Failed to update drop tags:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update tags', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated tags for drop ${dropId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dropId,
        topicIds 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-update-tags:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});