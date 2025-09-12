import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReprocessRequest {
  batchSize?: number;
  startFromId?: number;
  dryRun?: boolean;
}

interface ProcessResult {
  totalFound: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  lastProcessedId: number;
  details: Array<{
    id: number;
    url: string;
    status: 'success' | 'failed' | 'skipped';
    originalTitle: string;
    newTitle?: string;
    error?: string;
  }>;
  remainingVideos: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting bulk YouTube video reprocessing...');
    
    // Parse request
    const body: ReprocessRequest = req.method === 'POST' ? await req.json() : {};
    const batchSize = Math.min(body.batchSize || 20, 50); // Max 50 per batch to avoid timeouts
    const startFromId = body.startFromId || 0;
    const dryRun = body.dryRun || false;
    
    console.log(`Processing with batchSize: ${batchSize}, startFromId: ${startFromId}, dryRun: ${dryRun}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check YouTube API key availability
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!youtubeApiKey) {
      throw new Error('YouTube API key not configured');
    }
    
    // Get problematic YouTube videos
    console.log('Fetching problematic YouTube videos...');
    const { data: problematicVideos, error: fetchError } = await supabase
      .from('drops')
      .select('id, url, title, youtube_video_id, source_id, created_at')
      .eq('type', 'video')
      .like('url', '%youtube.com%')
      .or(`title.like.- YouTube%,youtube_video_id.is.null`)
      .gt('id', startFromId)
      .order('id', { ascending: true })
      .limit(batchSize);
    
    if (fetchError) {
      throw new Error(`Failed to fetch videos: ${fetchError.message}`);
    }
    
    if (!problematicVideos || problematicVideos.length === 0) {
      console.log('No more problematic videos found');
      return new Response(JSON.stringify({
        totalFound: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        lastProcessedId: startFromId,
        details: [],
        remainingVideos: 0,
        message: 'No more videos to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Found ${problematicVideos.length} videos to process`);
    
    // Get total remaining count
    const { count: totalRemaining } = await supabase
      .from('drops')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'video')
      .like('url', '%youtube.com%')
      .or(`title.like.- YouTube%,youtube_video_id.is.null`)
      .gt('id', startFromId);
    
    const result: ProcessResult = {
      totalFound: problematicVideos.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      lastProcessedId: startFromId,
      details: [],
      remainingVideos: totalRemaining || 0
    };
    
    if (dryRun) {
      console.log(`DRY RUN: Would process ${problematicVideos.length} videos`);
      result.details = problematicVideos.map(video => ({
        id: video.id,
        url: video.url,
        status: 'skipped' as const,
        originalTitle: video.title,
        error: 'Dry run mode'
      }));
      result.skipped = problematicVideos.length;
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Process videos with controlled concurrency (5 at a time to avoid rate limits)
    const concurrency = 5;
    for (let i = 0; i < problematicVideos.length; i += concurrency) {
      const batch = problematicVideos.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(problematicVideos.length / concurrency)}`);
      
      const promises = batch.map(async (video) => {
        try {
          console.log(`Processing video ${video.id}: ${video.url}`);
          result.processed++;
          result.lastProcessedId = video.id;
          
          // Extract video ID from URL
          const videoIdMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
          if (!videoIdMatch) {
            throw new Error('Could not extract video ID from URL');
          }
          
          const videoId = videoIdMatch[1];
          console.log(`Extracted video ID: ${videoId}`);
          
          // Call YouTube metadata function
          const { data: metadataResult, error: metadataError } = await supabase.functions.invoke('youtube-metadata', {
            body: { urlOrId: videoId }
          });
          
          if (metadataError || !metadataResult || metadataResult.error) {
            throw new Error(metadataError?.message || metadataResult?.error || 'YouTube metadata function failed');
          }
          
          console.log(`Got metadata for ${videoId}: ${metadataResult.title}`);
          
          // Update the drop with YouTube metadata
          const { error: updateError } = await supabase
            .from('drops')
            .update({
              title: metadataResult.title,
              summary: metadataResult.description || metadataResult.title,
              youtube_video_id: metadataResult.videoId,
              youtube_channel_id: metadataResult.channelId,
              youtube_published_at: metadataResult.publishedAt,
              youtube_category: metadataResult.category,
              youtube_duration_seconds: metadataResult.duration,
              youtube_view_count: metadataResult.viewCount,
              youtube_thumbnail_url: metadataResult.thumbnailUrl,
              // Update image_url if we got a better thumbnail
              image_url: metadataResult.thumbnailUrl || video.image_url,
              // Update published_at if we got YouTube publish date
              published_at: metadataResult.publishedAt || video.published_at,
              // Mark as processed
              og_scraped: true,
              // Reset tagging to reprocess with better data
              tag_done: false
            })
            .eq('id', video.id);
          
          if (updateError) {
            throw new Error(`Failed to update drop: ${updateError.message}`);
          }
          
          console.log(`Successfully updated video ${video.id}`);
          result.successful++;
          
          result.details.push({
            id: video.id,
            url: video.url,
            status: 'success',
            originalTitle: video.title,
            newTitle: metadataResult.title
          });
          
          // Small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Failed to process video ${video.id}:`, error.message);
          result.failed++;
          
          result.details.push({
            id: video.id,
            url: video.url,
            status: 'failed',
            originalTitle: video.title,
            error: error.message
          });
        }
      });
      
      // Wait for current batch to complete
      await Promise.allSettled(promises);
      
      // Delay between batches to be nice to YouTube API
      if (i + concurrency < problematicVideos.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('Bulk processing complete:', {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      remainingVideos: Math.max(0, result.remainingVideos - result.processed)
    });
    
    result.remainingVideos = Math.max(0, result.remainingVideos - result.processed);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Bulk reprocessing failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});