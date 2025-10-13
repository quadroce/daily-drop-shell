import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 20; // Process 20 videos per run

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🎬 Starting YouTube job creator...');

    // Find drops with YouTube videos that don't have jobs yet
    const { data: candidateDrops, error: dropsError } = await supabase
      .from('drops')
      .select(`
        id,
        youtube_video_id,
        youtube_channel_id,
        title,
        summary,
        content_topics!inner(
          topic_id,
          topics(slug, label)
        )
      `)
      .not('youtube_video_id', 'is', null)
      .not('youtube_channel_id', 'is', null)
      .eq('tag_done', true)
      .limit(BATCH_SIZE * 2); // Get more candidates than needed

    if (dropsError) {
      console.error('Error fetching drops:', dropsError);
      return new Response(JSON.stringify({ error: dropsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!candidateDrops || candidateDrops.length === 0) {
      console.log('No candidate drops found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No videos to process',
        jobsCreated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${candidateDrops.length} candidate drops`);

    // Filter out videos that already have jobs (ANY status - we only want one job per video EVER)
    const videoIds = candidateDrops.map(d => d.youtube_video_id).filter(Boolean);
    
    if (videoIds.length === 0) {
      console.log('No valid video IDs found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No valid video IDs',
        jobsCreated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Checking ${videoIds.length} video IDs against existing jobs...`);
    
    const { data: existingJobs, error: existingJobsError } = await supabase
      .from('social_comment_jobs')
      .select('video_id')
      .in('video_id', videoIds);

    if (existingJobsError) {
      console.error('Error checking existing jobs:', existingJobsError);
    }

    const existingVideoIds = new Set(existingJobs?.map(j => j.video_id) || []);
    console.log(`Found ${existingVideoIds.size} videos that already have jobs`);
    
    const newDrops = candidateDrops
      .filter(d => !existingVideoIds.has(d.youtube_video_id))
      .slice(0, BATCH_SIZE);

    if (newDrops.length === 0) {
      console.log('All candidate videos already have jobs');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All videos already processed',
        jobsCreated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Creating jobs for ${newDrops.length} new videos`);

    // Create jobs for each video
    const jobsToCreate = [];
    
    for (const drop of newDrops) {
      // Get first topic (primary topic)
      const topic = drop.content_topics?.[0]?.topics;
      if (!topic) {
        console.log(`Drop ${drop.id} has no topics, skipping`);
        continue;
      }

      const textHash = `${drop.youtube_video_id}-${topic.slug}`;
      
      jobsToCreate.push({
        video_id: drop.youtube_video_id,
        channel_id: drop.youtube_channel_id,
        video_title: drop.title,
        video_description: drop.summary || '',
        topic_slug: topic.slug,
        text_hash: textHash,
        status: 'queued',
        platform: 'youtube',
        locale: 'en',
        utm_campaign: 'auto-comment',
        utm_content: topic.slug,
        tries: 0
      });
    }

    if (jobsToCreate.length === 0) {
      console.log('No valid jobs to create');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No valid videos to process',
        jobsCreated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert jobs
    const { data: createdJobs, error: insertError } = await supabase
      .from('social_comment_jobs')
      .insert(jobsToCreate)
      .select();

    if (insertError) {
      console.error('Error creating jobs:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Created ${createdJobs?.length || 0} jobs`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Created ${createdJobs?.length || 0} comment jobs`,
      jobsCreated: createdJobs?.length || 0,
      processedVideos: newDrops.map(d => ({
        videoId: d.youtube_video_id,
        title: d.title,
        topic: d.content_topics?.[0]?.topics?.label
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('JOB_CREATOR_ERROR', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
