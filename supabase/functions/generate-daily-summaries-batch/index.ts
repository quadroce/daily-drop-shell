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

    // Get all active topics (all levels)
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('slug, id')
      .eq('is_active', true)
      .order('slug');

    if (topicsError) throw topicsError;

    console.log(`Found ${topics?.length || 0} active topics`);

    // Get unique dates from the last 90 days where we have published content
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: datesData, error: datesError } = await supabase
      .from('drops')
      .select('published_at')
      .not('published_at', 'is', null)
      .gte('published_at', ninetyDaysAgo.toISOString())
      .eq('tag_done', true)
      .order('published_at', { ascending: false });

    if (datesError) throw datesError;

    // Extract unique dates
    const uniqueDates = new Set<string>();
    datesData?.forEach(drop => {
      if (drop.published_at) {
        const date = new Date(drop.published_at).toISOString().split('T')[0];
        uniqueDates.add(date);
      }
    });

    const dates = Array.from(uniqueDates);
    console.log(`Found ${dates.length} unique dates with content in last 90 days`);

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Build all combinations to process
    const combinations: Array<{ topic: any; date: string }> = [];
    for (const topic of topics || []) {
      for (const date of dates) {
        combinations.push({ topic, date });
      }
    }

    console.log(`Total combinations to check: ${combinations.length}`);

    // Process in parallel batches to stay within timeout limits
    const BATCH_SIZE = 10; // Process 10 at a time
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

    for (let i = 0; i < combinations.length; i += BATCH_SIZE) {
      const batch = combinations.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async ({ topic, date }) => {
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
            return;
          }

          // Get descendants
          const { data: descendants } = await supabase
            .rpc('topic_descendants', { root: topic.id });
          
          const topicIds = descendants?.map((d: any) => d.id) || [topic.id];

          // Check if there are articles for this date
          const startDate = new Date(date);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(date);
          endDate.setHours(23, 59, 59, 999);

          const { count } = await supabase
            .from('drops')
            .select('id, content_topics!inner (topic_id)', { count: 'exact', head: true })
            .in('content_topics.topic_id', topicIds)
            .gte('published_at', startDate.toISOString())
            .lte('published_at', endDate.toISOString())
            .eq('tag_done', true);

          if (!count || count === 0) {
            skipped++;
            return;
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
        } catch (error) {
          console.error(`Error processing ${topic.slug}/${date}:`, error);
          errors.push(`${topic.slug}/${date}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }));

      // Delay between batches to avoid overwhelming the system
      if (i + BATCH_SIZE < combinations.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }

      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(combinations.length / BATCH_SIZE)}`);
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
