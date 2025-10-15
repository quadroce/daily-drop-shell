import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('🎬 YouTube Shorts Processor: Function invoked');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🎬 YouTube Shorts Processor: Processing scheduled jobs');

    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    // Find jobs that should be published now (scheduled_for <= now AND status = 'queued')
    const { data: jobsToProcess, error: queryError } = await supabase
      .from('short_jobs')
      .select('*')
      .eq('platform', 'youtube')
      .eq('status', 'queued')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(5); // Process max 5 at a time

    if (queryError) {
      throw new Error(`Failed to query jobs: ${queryError.message}`);
    }

    if (!jobsToProcess || jobsToProcess.length === 0) {
      console.log('✅ No jobs to process at this time');
      
      await supabase
        .from('cron_execution_log')
        .insert({
          job_name: 'youtube-shorts-processor',
          success: true,
          response_status: 200,
          response_body: JSON.stringify({ jobs_processed: 0, message: 'No jobs ready' })
        });

      return new Response(JSON.stringify({
        success: true,
        jobs_processed: 0,
        message: 'No jobs ready to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found ${jobsToProcess.length} jobs to process`);

    const results = [];

    for (const job of jobsToProcess) {
      console.log(`Processing job ${job.id}: ${job.kind} for topic ${job.topic_slug} at slot ${job.slot}`);

      // Update status to 'processing'
      await supabase
        .from('short_jobs')
        .update({ status: 'processing' })
        .eq('id', job.id);

      try {
        // Call the youtube-shorts-publish function
        const { data: publishResult, error: publishError } = await supabase.functions.invoke(
          'youtube-shorts-publish',
          {
            body: {
              mode: 'topic-digest',
              topic_slug: job.topic_slug,
              style: job.kind, // 'recap' or 'highlight'
              slot: job.slot,
              job_id: job.id
            }
          }
        );

        if (publishError) {
          throw new Error(`Publish failed: ${publishError.message}`);
        }

        console.log(`✅ Job ${job.id} completed successfully`);

        // Update job status to 'completed'
        await supabase
          .from('short_jobs')
          .update({
            status: 'completed',
            external_id: publishResult.video_id || null
          })
          .eq('id', job.id);

        results.push({
          job_id: job.id,
          success: true,
          video_id: publishResult.video_id
        });

      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);

        // Update job with error
        await supabase
          .from('short_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            tries: job.tries + 1
          })
          .eq('id', job.id);

        results.push({
          job_id: job.id,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Processed ${results.length} jobs`);

    // Log execution
    await supabase
      .from('cron_execution_log')
      .insert({
        job_name: 'youtube-shorts-processor',
        success: true,
        response_status: 200,
        response_body: JSON.stringify({
          jobs_processed: results.length,
          results: results
        })
      });

    return new Response(JSON.stringify({
      success: true,
      jobs_processed: results.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Processor error:', error);

    // Log error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('cron_execution_log')
      .insert({
        job_name: 'youtube-shorts-processor',
        success: false,
        error_message: error.message
      });

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
