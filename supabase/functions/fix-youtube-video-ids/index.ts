import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 Starting YouTube video IDs fix...');

    // Find all video drops without youtube_video_id but with YouTube URLs
    const { data: videosToFix, error: queryError } = await supabase
      .from('drops')
      .select('id, url, title')
      .eq('type', 'video')
      .is('youtube_video_id', null)
      .limit(1000);

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!videosToFix || videosToFix.length === 0) {
      console.log('No videos to fix');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No videos need fixing',
        fixed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${videosToFix.length} videos to fix`);

    let fixed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process each video
    for (const video of videosToFix) {
      const videoId = getYouTubeVideoId(video.url);
      
      if (!videoId) {
        console.log(`Skipping ${video.id}: not a YouTube URL`);
        skipped++;
        continue;
      }

      // Extract channel ID from HTML (best effort)
      let channelId: string | null = null;
      try {
        const response = await fetch(video.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const html = await response.text();
          const channelMatch = html.match(/"channelId":"([^"]+)"/);
          if (channelMatch) {
            channelId = channelMatch[1];
          }
        }
      } catch (e) {
        console.log(`Could not fetch channel ID for ${video.id}: ${e.message}`);
      }

      // Update the drop with extracted IDs
      const { error: updateError } = await supabase
        .from('drops')
        .update({
          youtube_video_id: videoId,
          ...(channelId && { youtube_channel_id: channelId }),
        })
        .eq('id', video.id);

      if (updateError) {
        const errMsg = `Failed to update ${video.id}: ${updateError.message}`;
        console.error(errMsg);
        errors.push(errMsg);
      } else {
        console.log(`✅ Fixed video ${video.id} (${video.title.substring(0, 50)}...): videoId=${videoId}, channelId=${channelId || 'unknown'}`);
        fixed++;
      }
    }

    console.log(`✅ Fix completed: ${fixed} fixed, ${skipped} skipped, ${errors.length} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      fixed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Fixed ${fixed} videos, skipped ${skipped}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fix-youtube-video-ids:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
