import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Article {
  id: number;
  title: string;
  summary: string | null;
  tags: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic_slug, date } = await req.json();
    
    if (!topic_slug || !date) {
      return new Response(
        JSON.stringify({ error: 'topic_slug and date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating summary for ${topic_slug} on ${date}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get topic and its descendants
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('slug', topic_slug)
      .eq('is_active', true)
      .single();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get descendant topics
    const { data: descendants } = await supabase
      .rpc('topic_descendants', { root: topic.id });
    
    const topicIds = descendants?.map((d: any) => d.id) || [topic.id];

    // Get articles for this date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const { data: articles } = await supabase
      .from('drops')
      .select(`
        id,
        title,
        summary,
        tags,
        content_topics!inner (topic_id)
      `)
      .in('content_topics.topic_id', topicIds)
      .gte('published_at', startDate.toISOString())
      .lte('published_at', endDate.toISOString())
      .eq('tag_done', true)
      .order('published_at', { ascending: false })
      .limit(50) as { data: Article[] | null };

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No articles found for this date' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${articles.length} articles`);

    // Prepare content for OpenAI
    const articlesText = articles.map((a, i) => 
      `${i + 1}. "${a.title}"${a.summary ? ` - ${a.summary}` : ''}`
    ).join('\n');

    const topicTitle = topic_slug.split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    const prompt = `You are analyzing daily tech content on the topic of ${topicTitle}.
    
Here are ${articles.length} articles published on ${date}:

${articlesText}

Write a brief 2-3 sentence summary in English explaining what was discussed that day. Focus on:
- The main themes and topics covered
- Key trends or patterns across the articles
- What readers will find in this collection

Keep it concise, informative, and engaging. Don't use marketing language or hyperbole.`;

    // Call OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Calling OpenAI...');
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a tech content curator who writes concise, informative summaries of daily content collections.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('OpenAI error:', error);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const summary = openAIData.choices[0].message.content.trim();

    console.log('Generated summary:', summary);

    // Save to database
    const { data: savedSummary, error: saveError } = await supabase
      .from('daily_topic_summaries')
      .upsert({
        topic_slug,
        date,
        summary_en: summary,
        article_count: articles.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'topic_slug,date'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving summary:', saveError);
      throw saveError;
    }

    console.log('Summary saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        summary: savedSummary,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-daily-topic-summary:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});