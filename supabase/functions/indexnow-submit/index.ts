// IndexNow submission edge function for rapid search engine indexing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexNowRequest {
  urls: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { urls }: IndexNowRequest = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'URLs array is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const API_KEY = 'dailydrops-indexnow-2025';
    const baseUrl = new URL(urls[0]);
    
    const payload = {
      host: baseUrl.hostname,
      key: API_KEY,
      keyLocation: `${baseUrl.origin}/${API_KEY}.txt`,
      urlList: urls
    };

    // Submit to IndexNow API
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const success = response.ok;
    
    return new Response(
      JSON.stringify({ 
        success, 
        statusCode: response.status,
        submitted: urls.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('IndexNow submission error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});