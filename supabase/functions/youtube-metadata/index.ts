import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface YouTubeMetadataRequest {
  urlOrId: string
}

interface YouTubeMetadataResponse {
  youtube_video_id: string
  title: string
  youtube_channel_id: string
  youtube_published_at: string
  youtube_category: string
  youtube_duration_seconds: number
  youtube_view_count: number
  youtube_thumbnail_url: string
}

function extractVideoId(urlOrId: string): string | null {
  // If it's already just an ID, return it
  if (!urlOrId.includes('/') && !urlOrId.includes('.')) {
    return urlOrId
  }
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = urlOrId.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

function parseDuration(duration: string): number {
  // Parse ISO 8601 duration format (PT4M13S -> 253 seconds)
  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!matches) return 0
  
  const hours = parseInt(matches[1] || '0')
  const minutes = parseInt(matches[2] || '0') 
  const seconds = parseInt(matches[3] || '0')
  
  return hours * 3600 + minutes * 60 + seconds
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured')
    }

    const { urlOrId }: YouTubeMetadataRequest = await req.json()
    
    if (!urlOrId) {
      return new Response(
        JSON.stringify({ error: 'urlOrId parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const videoId = extractVideoId(urlOrId)
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract video ID from URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[YouTube Metadata] Processing video ID: ${videoId}`)

    // Initialize Supabase client for caching
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check cache first
    const { data: cached } = await supabase
      .from('youtube_cache')
      .select('payload, expires_at')
      .eq('video_id', videoId)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (cached) {
      console.log(`[YouTube Metadata] Cache hit for ${videoId}`)
      return new Response(
        JSON.stringify(cached.payload),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[YouTube Metadata] Cache miss, fetching from API for ${videoId}`)

    // Fetch from YouTube API
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics&key=${YOUTUBE_API_KEY}`
    
    const response = await fetch(youtubeUrl)
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const video = data.items[0]
    const snippet = video.snippet
    const contentDetails = video.contentDetails
    const statistics = video.statistics

    // Build response
    const metadata: YouTubeMetadataResponse = {
      youtube_video_id: videoId,
      title: snippet.title,
      youtube_channel_id: snippet.channelId,
      youtube_published_at: snippet.publishedAt,
      youtube_category: snippet.categoryId || 'unknown',
      youtube_duration_seconds: parseDuration(contentDetails.duration),
      youtube_view_count: parseInt(statistics.viewCount || '0'),
      youtube_thumbnail_url: snippet.thumbnails?.maxres?.url || 
                            snippet.thumbnails?.high?.url || 
                            snippet.thumbnails?.medium?.url ||
                            snippet.thumbnails?.default?.url || ''
    }

    // Cache the result
    const { error: cacheError } = await supabase
      .from('youtube_cache')
      .upsert({
        video_id: videoId,
        payload: metadata,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })

    if (cacheError) {
      console.error('[YouTube Metadata] Cache error:', cacheError)
    } else {
      console.log(`[YouTube Metadata] Cached result for ${videoId}`)
    }

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[YouTube Metadata] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})