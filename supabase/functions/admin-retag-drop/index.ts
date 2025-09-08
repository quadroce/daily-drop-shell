import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { dropId } = await req.json();
    
    if (!dropId) {
      return new Response(
        JSON.stringify({ error: 'dropId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Retagging drop ${dropId}`);

    // Call tag-drops function for this specific drop
    const tagResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/tag-drops`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        drop_ids: [dropId],
        force_retag: true
      })
    });

    if (!tagResponse.ok) {
      const error = await tagResponse.text();
      console.error('Tag-drops failed:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to retag drop', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await tagResponse.json();
    
    console.log(`Successfully retagged drop ${dropId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dropId,
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-retag-drop:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});