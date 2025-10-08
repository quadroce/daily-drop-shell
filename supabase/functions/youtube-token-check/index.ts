import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking YouTube token status...');
    
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

    // Get token from cache
    const { data: cache } = await supabase
      .from('youtube_oauth_cache')
      .select('*')
      .eq('id', 1)
      .single();

    if (!cache || !cache.refresh_token) {
      return new Response(JSON.stringify({ 
        valid: false,
        error: 'no_token',
        message: 'No refresh token found. Please authorize the application.',
        missingScopes: REQUIRED_SCOPES
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check expiration
    const expiresAt = new Date(cache.expires_at);
    const now = new Date();
    const isExpired = expiresAt <= now;

    // Parse current scopes
    const currentScopes = cache.scopes ? cache.scopes.split(' ') : [];
    const missingScopes = REQUIRED_SCOPES.filter(scope => !currentScopes.includes(scope));

    // Check if token is still valid by making a test API call
    let tokenValid = false;
    if (!isExpired && cache.access_token) {
      try {
        const testResponse = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          {
            headers: {
              'Authorization': `Bearer ${cache.access_token}`
            }
          }
        );
        tokenValid = testResponse.ok;
      } catch (error) {
        console.error('Token validation failed:', error);
        tokenValid = false;
      }
    }

    const response = {
      valid: tokenValid && missingScopes.length === 0,
      tokenExists: true,
      isExpired,
      expiresAt: cache.expires_at,
      currentScopes,
      missingScopes,
      needsReauthorization: missingScopes.length > 0,
      canRefresh: !isExpired && cache.refresh_token,
      status: tokenValid ? 'active' : isExpired ? 'expired' : 'invalid'
    };

    console.log('Token check result:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-token-check:', error);
    return new Response(JSON.stringify({ 
      valid: false,
      error: 'check_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
