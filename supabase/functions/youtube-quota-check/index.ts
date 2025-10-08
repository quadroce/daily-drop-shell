import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// YouTube API quota costs (units per operation)
const QUOTA_COSTS = {
  'channels.list': 1,
  'videos.list': 1,
  'videos.insert': 1600,
  'commentThreads.insert': 50,
  'search.list': 100,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking YouTube quota...');
    
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
        message: 'No access token available'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Make a safe, low-cost API call to test quota
    const startTime = Date.now();
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=1',
      {
        headers: {
          'Authorization': `Bearer ${cache.access_token}`
        }
      }
    );
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.text();
      console.error('YouTube API error:', errorData);
      
      // Check for quota exceeded error
      if (response.status === 403) {
        try {
          const error = JSON.parse(errorData);
          if (error.error?.errors?.[0]?.reason === 'quotaExceeded') {
            return new Response(JSON.stringify({ 
              available: false,
              error: 'quota_exceeded',
              message: 'Daily quota limit exceeded',
              quotaCost: QUOTA_COSTS['channels.list'],
              dailyLimit: 10000,
              resetTime: 'Pacific Time midnight',
              costs: QUOTA_COSTS
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
      }

      return new Response(JSON.stringify({ 
        available: false,
        error: 'api_error',
        status: response.status,
        message: errorData
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    
    // Calculate estimated remaining quota based on today's usage
    // (This is an estimate since YouTube doesn't provide real-time quota info)
    const { data: todayEvents } = await supabase
      .from('short_job_events')
      .select('meta')
      .gte('created_at', new Date().toISOString().split('T')[0])
      .not('meta->quota_cost', 'is', null);

    let usedQuota = QUOTA_COSTS['channels.list']; // Count this check call
    if (todayEvents) {
      todayEvents.forEach(event => {
        const cost = event.meta?.quota_cost || 0;
        usedQuota += cost;
      });
    }

    const dailyLimit = 10000; // YouTube's default daily quota
    const remainingQuota = Math.max(0, dailyLimit - usedQuota);
    const estimatedUploadsRemaining = Math.floor(remainingQuota / QUOTA_COSTS['videos.insert']);
    const estimatedCommentsRemaining = Math.floor(remainingQuota / QUOTA_COSTS['commentThreads.insert']);

    const result = {
      available: true,
      apiWorking: response.ok,
      responseTime: duration,
      quotaInfo: {
        dailyLimit,
        estimatedUsed: usedQuota,
        estimatedRemaining: remainingQuota,
        percentageUsed: Math.round((usedQuota / dailyLimit) * 100),
        estimatedUploadsRemaining,
        estimatedCommentsRemaining
      },
      costs: QUOTA_COSTS,
      note: 'Quota usage is estimated based on logged events. Actual usage may vary.',
      channelInfo: {
        found: data.items?.length > 0,
        channelId: data.items?.[0]?.id
      }
    };

    console.log('Quota check result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-quota-check:', error);
    return new Response(JSON.stringify({ 
      available: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
