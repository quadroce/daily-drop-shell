import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing YouTube OAuth callback...');
    
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <script>window.close();</script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'Missing code or state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify state
    const { data: cache } = await supabase
      .from('youtube_oauth_cache')
      .select('oauth_state')
      .eq('id', 1)
      .single();

    if (!cache || cache.oauth_state !== state) {
      return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Exchange code for tokens
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!;
    const redirectUri = `${supabaseUrl}/functions/v1/youtube-oauth-callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return new Response(`
        <html>
          <body>
            <h1>Token Exchange Failed</h1>
            <p>${errorData}</p>
            <script>window.close();</script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const tokens: TokenResponse = await tokenResponse.json();
    console.log('Tokens received, scopes:', tokens.scope);

    // Store tokens in cache
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
    
    await supabase
      .from('youtube_oauth_cache')
      .upsert({
        id: 1,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scopes: tokens.scope,
        updated_at: new Date().toISOString()
      });

    console.log('Tokens stored successfully');

    // Return success page
    return new Response(`
      <html>
        <head>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
            }
            h1 { color: #2d3748; margin: 0 0 1rem 0; }
            p { color: #4a5568; margin: 0; }
            .success { color: #48bb78; font-size: 3rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Authorization Successful</h1>
            <p>YouTube integration is now active. You can close this window.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error in youtube-oauth-callback:', error);
    return new Response(`
      <html>
        <body>
          <h1>Error</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          <script>window.close();</script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
});
