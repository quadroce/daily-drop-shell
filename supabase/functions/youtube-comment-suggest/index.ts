import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating YouTube comment suggestions...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const { title, topicSlug, source } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate comment suggestions using GPT
    const prompt = `Generate 3-5 short, engaging YouTube comment variants for a video titled "${title}"${topicSlug ? ` about ${topicSlug}` : ''}${source ? ` from ${source}` : ''}.

Requirements:
- Each comment must be 140-220 characters
- Write in English
- Sound natural and human-like
- Show genuine interest or insight
- Avoid being promotional or spammy
- Don't use emojis excessively
- Each variant should have a different tone (excited, thoughtful, curious, appreciative, analytical)

Return ONLY a JSON array of strings, nothing else.`;

    const startTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates natural, engaging YouTube comments. Return only valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'openai_error',
        message: errorData
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    const duration = Date.now() - startTime;

    console.log('Generated text:', generatedText);

    // Parse the JSON response
    let suggestions: string[];
    try {
      suggestions = JSON.parse(generatedText);
      if (!Array.isArray(suggestions)) {
        throw new Error('Response is not an array');
      }
    } catch (error) {
      console.error('Failed to parse suggestions:', error);
      // Fallback: extract strings from the response
      const lines = generatedText.split('\n').filter(l => l.trim().length > 0);
      suggestions = lines
        .map(l => l.replace(/^[-•*]\s*/, '').replace(/^"\s*/, '').replace(/\s*"$/, '').trim())
        .filter(l => l.length >= 140 && l.length <= 220)
        .slice(0, 5);
    }

    // Validate suggestions
    suggestions = suggestions
      .filter(s => typeof s === 'string' && s.length >= 140 && s.length <= 220)
      .slice(0, 5);

    if (suggestions.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'generation_failed',
        message: 'Could not generate valid suggestions'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generated ${suggestions.length} comment suggestions in ${duration}ms`);

    return new Response(JSON.stringify({
      suggestions,
      count: suggestions.length,
      duration,
      input: { title, topicSlug, source }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-comment-suggest:', error);
    return new Response(JSON.stringify({ 
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
