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

    // Query drops that don't have jobs yet using a more efficient approach
    // We'll use RPC to get drops without existing jobs
    const { data: dropsWithoutJobs, error: queryError } = await supabase.rpc('get_drops_without_comment_jobs', {
      batch_limit: BATCH_SIZE
    });

    if (queryError) {
      console.error('Error fetching drops without jobs:', queryError);
      
      // Fallback to the old method if RPC fails
      console.log('Falling back to manual filtering...');
      
      const { data: allDrops, error: dropsError } = await supabase
        .from('drops')
        .select('id, youtube_video_id, youtube_channel_id, title, summary, tags')
        .not('youtube_video_id', 'is', null)
        .not('youtube_channel_id', 'is', null)
        .eq('tag_done', true)
        .order('created_at', { ascending: false })
        .limit(500); // Check more videos

      if (dropsError) {
        console.error('Error fetching drops:', dropsError);
        return new Response(JSON.stringify({ error: dropsError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!allDrops || allDrops.length === 0) {
        console.log('No candidate drops found');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No videos to process',
          jobsCreated: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Found ${allDrops.length} candidate drops, filtering...`);

      // Check which ones already have jobs
      const videoIds = allDrops.map(d => d.youtube_video_id).filter(Boolean);
      const { data: existingJobs } = await supabase
        .from('social_comment_jobs')
        .select('video_id')
        .in('video_id', videoIds);

      const existingVideoIds = new Set(existingJobs?.map(j => j.video_id) || []);
      console.log(`Found ${existingVideoIds.size} videos that already have jobs`);
      
      var newDrops = allDrops
        .filter(d => !existingVideoIds.has(d.youtube_video_id))
        .slice(0, BATCH_SIZE);
    } else {
      var newDrops = dropsWithoutJobs || [];
    }

    if (!newDrops || newDrops.length === 0) {
      console.log('No new videos to process');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No new videos found',
        jobsCreated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Creating jobs for ${newDrops.length} new videos`);

    // Create jobs for each video
    const jobsToCreate = [];
    
    for (const drop of newDrops) {
      // Get first tag as topic slug (tags array contains topic slugs)
      const topicSlug = drop.tags?.[0];
      if (!topicSlug) {
        console.log(`Drop ${drop.id} has no tags, skipping`);
        continue;
      }

      const textHash = `${drop.youtube_video_id}-${topicSlug}`;
      
      jobsToCreate.push({
        video_id: drop.youtube_video_id,
        channel_id: drop.youtube_channel_id,
        video_title: drop.title,
        video_description: drop.summary || '',
        topic_slug: topicSlug,
        text_hash: textHash,
        status: 'queued',
        platform: 'youtube',
        locale: 'en',
        utm_campaign: 'auto-comment',
        utm_content: topicSlug,
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
        topic: d.tags?.[0]
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
