import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting YouTube video reprocessing...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const testVideoUrl = 'https://www.youtube.com/watch?v=23Apm1exRrs';
    const testVideoId = '23Apm1exRrs';
    
    console.log(`Testing with video URL: ${testVideoUrl}`);
    
    // Step 1: Test YouTube metadata function directly
    console.log('Step 1: Testing youtube-metadata function...');
    const { data: metadataResult, error: metadataError } = await supabase.functions.invoke('youtube-metadata', {
      body: { urlOrId: testVideoId }
    });
    
    if (metadataError) {
      console.error('YouTube metadata function failed:', metadataError);
      return new Response(JSON.stringify({
        success: false,
        step: 'youtube-metadata',
        error: metadataError.message,
        videoId: testVideoId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    console.log('YouTube metadata result:', metadataResult);
    
    // Step 2: Reset the drop for reprocessing
    console.log('Step 2: Resetting drop for reprocessing...');
    const { error: updateError } = await supabase
      .from('drops')
      .update({ 
        og_scraped: false, 
        tag_done: false,
        // Clear YouTube fields to see if they get repopulated
        youtube_video_id: null,
        youtube_channel_id: null,
        youtube_duration_seconds: null,
        youtube_published_at: null,
        youtube_category: null,
        youtube_view_count: null,
        youtube_thumbnail_url: null,
        // Reset title and summary to see if they get updated
        title: 'YouTube Video (Reprocessing)',
        summary: 'Reprocessing video metadata...'
      })
      .eq('url', testVideoUrl);
    
    if (updateError) {
      console.error('Failed to reset drop:', updateError);
      return new Response(JSON.stringify({
        success: false,
        step: 'reset-drop',
        error: updateError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    // Step 3: Call scrape-og function to reprocess
    console.log('Step 3: Calling scrape-og to reprocess...');
    const { data: scrapeResult, error: scrapeError } = await supabase.functions.invoke('scrape-og', {
      body: { 
        url: testVideoUrl, 
        source_id: 240  // Amazon Web Services source_id from the original drop
      }
    });
    
    if (scrapeError) {
      console.error('Scrape-OG function failed:', scrapeError);
      return new Response(JSON.stringify({
        success: false,
        step: 'scrape-og',
        error: scrapeError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    console.log('Scrape-OG result:', scrapeResult);
    
    // Step 4: Verify the updated drop
    console.log('Step 4: Checking updated drop...');
    const { data: updatedDrop, error: fetchError } = await supabase
      .from('drops')
      .select('*')
      .eq('url', testVideoUrl)
      .single();
    
    if (fetchError) {
      console.error('Failed to fetch updated drop:', fetchError);
      return new Response(JSON.stringify({
        success: false,
        step: 'fetch-updated-drop',
        error: fetchError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    console.log('Updated drop:', updatedDrop);
    
    // Compile results
    const results = {
      success: true,
      testVideoUrl,
      testVideoId,
      steps: {
        youtubeMetadata: {
          success: !metadataError,
          data: metadataResult,
          error: metadataError
        },
        dropReset: {
          success: !updateError,
          error: updateError
        },
        scrapeOg: {
          success: !scrapeError,
          data: scrapeResult,
          error: scrapeError
        },
        updatedDrop: {
          success: !fetchError,
          data: updatedDrop,
          error: fetchError
        }
      },
      comparison: {
        beforeTitle: '- YouTube',
        afterTitle: updatedDrop?.title || 'N/A',
        beforeYouTubeData: 'All NULL',
        afterYouTubeData: {
          video_id: updatedDrop?.youtube_video_id,
          duration: updatedDrop?.youtube_duration_seconds,
          views: updatedDrop?.youtube_view_count,
          channel: updatedDrop?.youtube_channel_id,
          thumbnail: updatedDrop?.youtube_thumbnail_url
        },
        success: updatedDrop?.youtube_video_id !== null && updatedDrop?.title !== '- YouTube'
      }
    };
    
    console.log('Final test results:', results);
    
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Test failed:', error);
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