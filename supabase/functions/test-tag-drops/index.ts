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
    console.log('=== TESTING OPENAI AND TAG-DROPS ===');
    
    // Test 1: Direct OpenAI API call
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI key present:', !!openaiKey);
    console.log('OpenAI key length:', openaiKey?.length);
    
    if (!openaiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'OPENAI_API_KEY not found' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test OpenAI API directly
    console.log('Testing OpenAI API directly...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "test successful" in JSON format like {"result": "test successful"}' }
        ],
        max_tokens: 50,
        temperature: 0.1
      }),
    });

    console.log('OpenAI response status:', openaiResponse.status);
    const openaiData = await openaiResponse.json();
    console.log('OpenAI response:', openaiData);

    if (!openaiResponse.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        step: 'openai_direct_call',
        error: openaiData.error?.message || 'OpenAI API failed',
        response: openaiData
      }), {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test 2: Call tag-drops function
    console.log('Testing tag-drops function...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tagDropsData, error: tagDropsError } = await supabase.functions.invoke('tag-drops', {
      body: { limit: 1, concurrent_requests: 1 }
    });

    console.log('Tag-drops response:', { data: tagDropsData, error: tagDropsError });

    return new Response(JSON.stringify({ 
      success: true, 
      openai_test: {
        success: true,
        response: openaiData.choices[0]?.message?.content
      },
      tag_drops_test: {
        success: !tagDropsError,
        data: tagDropsData,
        error: tagDropsError
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});