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
    console.log('Starting YouTube integration test...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test video ID from the problematic video
    const testVideoId = '23Apm1exRrs';
    const testUrl = `https://www.youtube.com/watch?v=${testVideoId}`;
    
    console.log(`Testing with video ID: ${testVideoId}`);
    
    // Step 1: Check if YouTube API key is configured
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    console.log(`YouTube API Key configured: ${youtubeApiKey ? 'YES' : 'NO'}`);
    
    if (!youtubeApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'YouTube API Key not configured',
        step: 'api_key_check'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
    
    // Step 2: Test YouTube metadata function directly
    console.log('Testing youtube-metadata function...');
    const { data: metadataResult, error: metadataError } = await supabase.functions.invoke('youtube-metadata', {
      body: { urlOrId: testVideoId }
    });
    
    console.log('YouTube metadata result:', metadataResult);
    console.log('YouTube metadata error:', metadataError);
    
    // Step 3: Test YouTube API directly
    console.log('Testing YouTube API directly...');
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${testVideoId}&part=snippet,statistics,contentDetails&key=${youtubeApiKey}`;
    
    const youtubeResponse = await fetch(youtubeApiUrl);
    const youtubeData = await youtubeResponse.json();
    
    console.log('Direct YouTube API response:', youtubeData);
    
    // Step 4: Check the drop in database
    console.log('Checking drop in database...');
    const { data: dropData, error: dropError } = await supabase
      .from('drops')
      .select('*')
      .eq('url', testUrl)
      .single();
    
    console.log('Drop data:', dropData);
    console.log('Drop error:', dropError);
    
    // Step 5: Test scrape-og function as fallback
    console.log('Testing scrape-og function...');
    const { data: scrapeResult, error: scrapeError } = await supabase.functions.invoke('scrape-og', {
      body: { url: testUrl, sourceId: dropData?.source_id || null }
    });
    
    console.log('Scrape-OG result:', scrapeResult);
    console.log('Scrape-OG error:', scrapeError);
    
    // Compile test results
    const results = {
      success: true,
      tests: {
        apiKeyConfigured: !!youtubeApiKey,
        youtubeMetadataFunction: {
          success: !metadataError,
          data: metadataResult,
          error: metadataError
        },
        directYouTubeApi: {
          success: youtubeResponse.ok,
          status: youtubeResponse.status,
          data: youtubeData,
          hasItems: youtubeData?.items?.length > 0
        },
        dropInDatabase: {
          found: !!dropData,
          data: dropData,
          error: dropError
        },
        scrapeOgFallback: {
          success: !scrapeError,
          data: scrapeResult,
          error: scrapeError
        }
      },
      diagnosis: {
        youtubeApiWorking: youtubeResponse.ok && youtubeData?.items?.length > 0,
        metadataFunctionWorking: !metadataError && !!metadataResult,
        dropExists: !!dropData,
        hasYoutubeMetadata: !!(dropData?.youtube_video_id || dropData?.youtube_title || dropData?.youtube_description)
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