import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TESTING EMBEDDING INITIALIZATION ===');
    
    // Check if OpenAI key is available
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI key present:', !!openaiKey);
    
    if (!openaiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'OPENAI_API_KEY not found in environment' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test OpenAI connection
    console.log('Testing OpenAI API connection...');
    const testResponse = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
    });
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return new Response(JSON.stringify({ 
        success: false, 
        error: `OpenAI API test failed: ${testResponse.status} ${errorText}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Calling embed-drops function...');
    
    // Call embed-drops function to generate embeddings for recent content
    const { data: embedData, error: embedError } = await supabase.functions.invoke('embed-drops', {
      body: { since_minutes: 10080 } // Last 7 days
    });

    console.log('Embed-drops response:', { data: embedData, error: embedError });

    if (embedError) {
      return new Response(JSON.stringify({ 
        success: false, 
        step: 'embed_drops_call',
        error: embedError.message,
        details: embedError
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Embedding system initialized successfully',
      openai_connected: true,
      embed_drops_result: embedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});