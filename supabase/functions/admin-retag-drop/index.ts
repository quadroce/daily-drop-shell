import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { dropId } = await req.json();
    
    if (!dropId) {
      console.error('Missing dropId in request body');
      return new Response(
        JSON.stringify({ error: 'dropId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting retag process for drop ${dropId}`);

    // Call tag-drops function using Supabase client
    const { data, error } = await supabase.functions.invoke('tag-drops', {
      body: {
        drop_ids: [dropId],
        force_retag: true
      },
      headers: {
        Authorization: authHeader,
      }
    });

    if (error) {
      console.error('Tag-drops function error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to retag drop', 
          details: error.message || error 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully retagged drop ${dropId}:`, data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dropId,
        result: data 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-retag-drop:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});