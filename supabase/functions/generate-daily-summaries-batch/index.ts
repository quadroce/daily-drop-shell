import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch daily summaries generation...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active level-1 topics
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('slug')
      .eq('is_active', true)
      .eq('level', 1);

    if (topicsError) throw topicsError;

    console.log(`Found ${topics?.length || 0} active topics`);

    // Get dates from last 7 days
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // For each topic and date combination
    for (const topic of topics || []) {
      for (const date of dates) {
        try {
          // Check if summary already exists
          const { data: existingSummary } = await supabase
            .from('daily_topic_summaries')
            .select('id')
            .eq('topic_slug', topic.slug)
            .eq('date', date)
            .maybeSingle();

          if (existingSummary) {
            skipped++;
            continue;
          }

          // Get topic and descendants
          const { data: topicData } = await supabase
            .from('topics')
            .select('id')
            .eq('slug', topic.slug)
            .eq('is_active', true)
            .single();

          if (!topicData) continue;

          const { data: descendants } = await supabase
            .rpc('topic_descendants', { root: topicData.id });
          
          const topicIds = descendants?.map((d: any) => d.id) || [topicData.id];

          // Check if there are articles for this date
          const startDate = new Date(date);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(date);
          endDate.setHours(23, 59, 59, 999);

          const { data: articles, count } = await supabase
            .from('drops')
            .select('id, content_topics!inner (topic_id)', { count: 'exact', head: true })
            .in('content_topics.topic_id', topicIds)
            .gte('published_at', startDate.toISOString())
            .lte('published_at', endDate.toISOString())
            .eq('tag_done', true);

          if (!count || count === 0) {
            skipped++;
            continue;
          }

          // Generate summary by calling the generate-daily-topic-summary function
          const { error: generateError } = await supabase.functions.invoke(
            'generate-daily-topic-summary',
            {
              body: { topic_slug: topic.slug, date }
            }
          );

          if (generateError) {
            console.error(`Error generating summary for ${topic.slug} on ${date}:`, generateError);
            errors.push(`${topic.slug}/${date}: ${generateError.message}`);
          } else {
            generated++;
            console.log(`Generated summary for ${topic.slug} on ${date}`);
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Error processing ${topic.slug}/${date}:`, error);
          errors.push(`${topic.slug}/${date}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    console.log(`Batch generation completed: ${generated} generated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        generated,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-daily-summaries-batch:', error);
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
