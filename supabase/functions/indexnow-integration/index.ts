import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IndexNowRequest {
  urls: string[];
  trigger?: string;
}

async function submitToIndexNow(urls: string[], apiKey: string): Promise<{ success: boolean; statusCode: number; submitted: number }> {
  if (!urls.length) {
    return { success: false, statusCode: 400, submitted: 0 };
  }

  const baseUrl = new URL(urls[0]);
  
  const payload = {
    host: baseUrl.hostname,
    key: apiKey,
    keyLocation: `${baseUrl.origin}/${apiKey}.txt`,
    urlList: urls
  };

  console.log('Submitting to IndexNow:', { 
    host: payload.host, 
    urlCount: urls.length,
    keyLocation: payload.keyLocation 
  });

  try {
    const response = await fetch('https://www.bing.com/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const success = response.ok;
    console.log(`IndexNow response: ${response.status} ${response.statusText}`);
    
    return {
      success,
      statusCode: response.status,
      submitted: success ? urls.length : 0
    };
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return { success: false, statusCode: 500, submitted: 0 };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { urls, trigger }: IndexNowRequest = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'URLs array is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const indexnowKey = Deno.env.get('INDEXNOW_KEY');
    if (!indexnowKey) {
      console.error('INDEXNOW_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'IndexNow key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`IndexNow submission triggered by: ${trigger || 'manual'}`);
    console.log(`Submitting ${urls.length} URLs to IndexNow`);

    const result = await submitToIndexNow(urls, indexnowKey);
    
    // Log the submission for monitoring
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
      await supabase
        .from('sitemap_runs')
        .insert({
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          success: result.success,
          total_urls: result.submitted,
          bing_ping_success: result.success,
          error_message: result.success ? null : `IndexNow failed with status ${result.statusCode}`
        });
    } catch (logError) {
      console.warn('Failed to log IndexNow submission:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: result.success, 
        statusCode: result.statusCode,
        submitted: result.submitted,
        trigger: trigger || 'manual'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('IndexNow integration error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});