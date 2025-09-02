import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('=== TAG-DROPS TEST STARTED ===');
    
    // Test environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('OPENAI_API_KEY present:', !!OPENAI_API_KEY);
    console.log('OPENAI_API_KEY length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
    console.log('SERVICE_ROLE_KEY present:', !!SERVICE_ROLE_KEY);
    console.log('SERVICE_ROLE_KEY length:', SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.length : 0);
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is missing from environment');
    }
    
    if (!SERVICE_ROLE_KEY) {
      throw new Error('SERVICE_ROLE_KEY is missing from environment');
    }

    // Test OpenAI API
    console.log('Testing OpenAI API connection...');
    const testResponse = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });
    
    console.log('OpenAI API response status:', testResponse.status);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API test failed: ${testResponse.status} ${errorText}`);
    }
    
    const models = await testResponse.json();
    console.log('Available models count:', models.data ? models.data.length : 0);
    
    // Test Supabase connection
    console.log('Testing Supabase connection...');
    const supabaseResponse = await fetch('https://qimelntuxquptqqynxzv.supabase.co/rest/v1/topics?select=id,slug,label&limit=3', {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Supabase API response status:', supabaseResponse.status);
    
    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error('Supabase API error:', errorText);
      throw new Error(`Supabase API test failed: ${supabaseResponse.status} ${errorText}`);
    }
    
    const topics = await supabaseResponse.json();
    console.log('Topics found:', topics.length);
    console.log('Sample topics:', topics);
    
    console.log('=== ALL TESTS PASSED ===');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'All tests passed',
      openai_key_present: !!OPENAI_API_KEY,
      service_key_present: !!SERVICE_ROLE_KEY,
      topics_count: topics.length,
      models_available: models.data ? models.data.length : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('=== TEST FAILED ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      openai_key_present: !!Deno.env.get('OPENAI_API_KEY'),
      service_key_present: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});