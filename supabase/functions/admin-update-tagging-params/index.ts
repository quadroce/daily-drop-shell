import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Estrai user dal JWT per validare i permessi
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { params } = await req.json();
    
    if (!params || typeof params !== 'object') {
      return new Response(
        JSON.stringify({ error: 'params object is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating tagging parameters:', params);

    const updates = [];
    for (const [paramName, paramValue] of Object.entries(params)) {
      const { error } = await supabase
        .from('tagging_params')
        .upsert({
          param_name: paramName,
          param_value: paramValue,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`Failed to update parameter ${paramName}:`, error);
        return new Response(
          JSON.stringify({ 
            error: `Failed to update parameter ${paramName}`, 
            details: error.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      updates.push({ paramName, paramValue });
    }

    // Log dell'azione
    await supabase.rpc('log_admin_action', {
      _action: 'update_tagging_params',
      _resource_type: 'tagging_params',
      _resource_id: null,
      _details: { updated_params: updates }
    });

    console.log('Successfully updated tagging parameters');

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updates
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-update-tagging-params:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});