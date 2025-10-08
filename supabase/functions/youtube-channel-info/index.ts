import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching YouTube channel info...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get access token
    const { data: cache } = await supabase
      .from('youtube_oauth_cache')
      .select('access_token, expires_at')
      .eq('id', 1)
      .single();

    if (!cache || !cache.access_token) {
      return new Response(JSON.stringify({ 
        error: 'no_token',
        message: 'No access token available. Please authorize first.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if token is expired
    const expiresAt = new Date(cache.expires_at);
    if (expiresAt <= new Date()) {
      return new Response(JSON.stringify({ 
        error: 'token_expired',
        message: 'Access token expired. Please refresh or reauthorize.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch channel info
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${cache.access_token}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('YouTube API error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'api_error',
        status: response.status,
        message: errorData
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'no_channel',
        message: 'No channel found for this account'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const channel = data.items[0];
    const result = {
      channelId: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      customUrl: channel.snippet.customUrl,
      thumbnails: channel.snippet.thumbnails,
      uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
      statistics: {
        viewCount: channel.statistics.viewCount,
        subscriberCount: channel.statistics.subscriberCount,
        videoCount: channel.statistics.videoCount
      },
      country: channel.snippet.country,
      publishedAt: channel.snippet.publishedAt
    };

    console.log('Channel info retrieved:', result.channelId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-channel-info:', error);
    return new Response(JSON.stringify({ 
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
