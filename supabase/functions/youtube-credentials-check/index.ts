import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for presence of secrets (never expose values)
    const secrets = {
      YOUTUBE_CLIENT_ID: !!Deno.env.get('YOUTUBE_CLIENT_ID'),
      YOUTUBE_CLIENT_SECRET: !!Deno.env.get('YOUTUBE_CLIENT_SECRET'),
      YOUTUBE_REFRESH_TOKEN: !!Deno.env.get('YOUTUBE_REFRESH_TOKEN'),
      YOUTUBE_API_KEY: !!Deno.env.get('YOUTUBE_API_KEY'),
      GCLOUD_TTS_PROJECT: !!Deno.env.get('GCLOUD_TTS_PROJECT'),
      GCLOUD_TTS_SA_JSON_BASE64: !!Deno.env.get('GCLOUD_TTS_SA_JSON_BASE64'),
      OPENAI_API_KEY: !!Deno.env.get('OPENAI_API_KEY'),
    };

    return new Response(
      JSON.stringify({ secrets }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error checking credentials:', error);
    return new Response(
      JSON.stringify({ error: 'credentials_check_failed' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
