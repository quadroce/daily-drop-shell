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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📅 YouTube Shorts Scheduler: Creating jobs for tomorrow');

    // Get rotation configuration
    const { data: config, error: configError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'shorts_weekly_rotation')
      .single();

    if (configError || !config) {
      throw new Error('Failed to load rotation configuration');
    }

    const rotation = config.value as {
      timezone: string;
      slots: Array<{ slot: number; time: string; type: string }>;
      rotation: Record<string, string[]>;
    };

    // Calculate tomorrow's date in Rome timezone
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = tomorrow.getDay().toString();
    const topics = rotation.rotation[dayOfWeek];

    if (!topics || topics.length !== 2) {
      throw new Error(`No topics configured for day ${dayOfWeek}`);
    }

    console.log(`📌 Tomorrow is day ${dayOfWeek}, topics: ${topics.join(', ')}`);

    // Create jobs for both slots
    const jobsToCreate = [];
    
    for (let i = 0; i < rotation.slots.length; i++) {
      const slot = rotation.slots[i];
      const topicSlug = topics[i];
      
      // Parse time (e.g., "11:15")
      const [hours, minutes] = slot.time.split(':').map(Number);
      
      // Create scheduled_for timestamp in Rome timezone
      const scheduledFor = new Date(tomorrow);
      scheduledFor.setHours(hours, minutes, 0, 0);
      
      // Convert to UTC for storage
      const scheduledForUTC = new Date(scheduledFor.toLocaleString('en-US', { timeZone: 'UTC' }));

      jobsToCreate.push({
        platform: 'youtube',
        kind: slot.type, // 'recap' or 'highlight'
        topic_slug: topicSlug,
        slot: slot.slot,
        scheduled_for: scheduledForUTC.toISOString(),
        status: 'queued',
        tries: 0
      });
    }

    console.log(`Creating ${jobsToCreate.length} jobs:`, jobsToCreate);

    // Insert jobs
    const { data: createdJobs, error: insertError } = await supabase
      .from('short_jobs')
      .insert(jobsToCreate)
      .select();

    if (insertError) {
      throw new Error(`Failed to create jobs: ${insertError.message}`);
    }

    console.log(`✅ Created ${createdJobs?.length || 0} YouTube Shorts jobs for tomorrow`);

    // Log to cron execution log
    await supabase
      .from('cron_execution_log')
      .insert({
        job_name: 'youtube-shorts-scheduler',
        success: true,
        response_status: 200,
        response_body: JSON.stringify({
          jobs_created: createdJobs?.length || 0,
          scheduled_date: tomorrow.toISOString().split('T')[0],
          topics: topics
        })
      });

    return new Response(JSON.stringify({
      success: true,
      jobs_created: createdJobs?.length || 0,
      scheduled_date: tomorrow.toISOString().split('T')[0],
      topics: topics,
      jobs: createdJobs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Scheduler error:', error);

    // Log error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('cron_execution_log')
      .insert({
        job_name: 'youtube-shorts-scheduler',
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
