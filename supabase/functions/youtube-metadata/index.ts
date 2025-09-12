import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface YouTubeMetadataRequest {
  urlOrId: string
}

interface YouTubeMetadataResponse {
  videoId: string
  title: string
  description: string
  channelTitle: string
  channelId: string
  publishedAt: string
  duration: number // in seconds
  viewCount: number
  thumbnailUrl: string
  category: string
}

/**
 * Extracts YouTube video ID from various URL formats
 */
function extractVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  
  // If it's already just an ID (no URL structure), return it
  if (!urlOrId.includes('/') && !urlOrId.includes('=') && urlOrId.length === 11) {
    return urlOrId;
  }
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
    /youtube\.com\/watch\/.*[?&]v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Parses ISO 8601 duration string (PT#M#S) to seconds
 */
function parseDuration(duration: string | undefined): number {
  if (!duration || typeof duration !== 'string') {
    console.log(`Invalid duration provided: ${duration}`);
    return 0;
  }
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    console.log(`Could not parse duration: ${duration}`);
    return 0;
  }
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urlOrId }: YouTubeMetadataRequest = await req.json();
    
    if (!urlOrId) {
      return new Response(JSON.stringify({ error: 'urlOrId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const videoId = extractVideoId(urlOrId);
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Invalid YouTube URL or video ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`Processing YouTube video ID: ${videoId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first - using the existing table structure
    const { data: cachedData } = await supabase
      .from('youtube_cache')
      .select('*')
      .eq('video_id', videoId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedData) {
      console.log(`Using cached data for video ${videoId}`);
      return new Response(JSON.stringify(cachedData.payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get YouTube API key
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!youtubeApiKey) {
      throw new Error('YouTube API key not configured');
    }

    // Call YouTube API with retry logic
    let retries = 3;
    let youtubeData: any = null;
    
    while (retries > 0 && !youtubeData) {
      try {
        console.log(`Calling YouTube API for video ${videoId} (${4 - retries}/3 attempts)`);
        
        const youtubeUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${youtubeApiKey}`;
        const response = await fetch(youtubeUrl);
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error(`YouTube API error (${response.status}):`, errorData);
          
          if (response.status === 403) {
            const errorObj = JSON.parse(errorData);
            if (errorObj.error?.errors?.[0]?.reason === 'quotaExceeded') {
              throw new Error('YouTube API quota exceeded');
            }
            throw new Error(`YouTube API forbidden: ${errorObj.error?.message || 'Unknown error'}`);
          }
          
          throw new Error(`YouTube API error: ${response.status}`);
        }
        
        youtubeData = await response.json();
        console.log(`YouTube API response received for video ${videoId}`);
        
        if (!youtubeData.items || youtubeData.items.length === 0) {
          throw new Error('Video not found or not available');
        }
        
        break;
      } catch (error) {
        retries--;
        console.error(`YouTube API attempt failed:`, error.message);
        
        if (retries === 0) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const processVideoMetadata = async (data: any): Promise<YouTubeMetadataResponse> => {
      const video = data.items[0];
      const snippet = video.snippet;
      const statistics = video.statistics;
      const contentDetails = video.contentDetails;

      // Add safety checks for required fields
      if (!snippet) {
        throw new Error('Video snippet data not available');
      }

      if (!snippet.title) {
        throw new Error('Video title not available');
      }

      console.log(`Processing video: ${snippet.title}`);
      console.log(`Content details duration:`, contentDetails?.duration);

      const metadata: YouTubeMetadataResponse = {
        videoId,
        title: snippet.title,
        description: snippet.description || '',
        channelTitle: snippet.channelTitle || 'Unknown Channel',
        channelId: snippet.channelId || '',
        publishedAt: snippet.publishedAt || new Date().toISOString(),
        duration: parseDuration(contentDetails?.duration),
        viewCount: parseInt(statistics?.viewCount || '0'),
        thumbnailUrl: snippet.thumbnails?.maxresdefault?.url || 
                     snippet.thumbnails?.high?.url || 
                     snippet.thumbnails?.medium?.url || 
                     snippet.thumbnails?.default?.url || '',
        category: snippet.categoryId || 'unknown'
      };

      console.log(`Processed metadata for video: ${metadata.title}`);

      // Cache the result for 24 hours using existing table structure
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await supabase
        .from('youtube_cache')
        .upsert({
          video_id: videoId,
          payload: metadata,
          expires_at: expiresAt.toISOString(),
          fetched_at: new Date().toISOString()
        });

      return metadata;
    };

    const metadata = await processVideoMetadata(youtubeData);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-metadata function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      videoId: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});