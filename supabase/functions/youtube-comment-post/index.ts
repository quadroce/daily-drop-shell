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
    console.log('Posting YouTube comment...');
    
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

    // Parse request
    const { videoId, comment } = await req.json();

    if (!videoId || !comment) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['videoId', 'comment']
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate comment length
    if (comment.length < 1 || comment.length > 10000) {
      return new Response(JSON.stringify({ 
        error: 'Invalid comment length',
        message: 'Comment must be between 1 and 10000 characters',
        length: comment.length
      }), {
        status: 400,
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
        message: 'No access token available'
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
        message: 'Access token expired. Please refresh.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Post comment to YouTube
    const startTime = Date.now();
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cache.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: {
            videoId,
            topLevelComment: {
              snippet: {
                textOriginal: comment
              }
            }
          }
        })
      }
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.text();
      console.error('YouTube API error:', errorData);
      
      let errorCode = 'api_error';
      let errorMessage = errorData;

      try {
        const error = JSON.parse(errorData);
        if (error.error?.errors?.[0]) {
          errorCode = error.error.errors[0].reason;
          errorMessage = error.error.errors[0].message;
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
      }

      // Log error event
      await supabase.from('short_job_events').insert({
        stage: 'comment_post',
        ok: false,
        meta: {
          action: 'post_comment',
          api: 'youtube',
          status: response.status,
          duration_ms: duration,
          quota_cost: 50,
          error_code: errorCode,
          video_id: videoId
        }
      });

      return new Response(JSON.stringify({ 
        success: false,
        error: errorCode,
        message: errorMessage,
        status: response.status
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const commentId = data.id;

    console.log(`Comment posted successfully: ${commentId}`);

    // Log success event
    await supabase.from('short_job_events').insert({
      stage: 'comment_post',
      ok: true,
      meta: {
        action: 'post_comment',
        api: 'youtube',
        status: 200,
        duration_ms: duration,
        quota_cost: 50,
        video_id: videoId,
        comment_id: commentId
      }
    });

    return new Response(JSON.stringify({
      success: true,
      commentId,
      videoId,
      duration,
      quotaCost: 50,
      comment: data.snippet.topLevelComment.snippet.textDisplay
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-comment-post:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
