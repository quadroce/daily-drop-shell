import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JWTPayload {
  sub: string;
  app_metadata?: {
    role?: string;
  };
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

async function validateAdminRole(authHeader: string | null): Promise<{ valid: boolean; payload?: JWTPayload }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }

  const token = authHeader.substring(7);
  const payload = decodeJWT(token);
  
  if (!payload) {
    return { valid: false };
  }

  // Check role from profiles table instead of JWT metadata
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', payload.sub)
      .single();

    if (error) {
      console.log('Error fetching user profile:', error);
      return { valid: false };
    }

    const userRole = profile?.role;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    
    if (!isAdmin) {
      console.log(`Access denied: user role '${userRole}' is not admin or superadmin`);
      return { valid: false };
    }

    return { valid: true, payload };
  } catch (error) {
    console.log('Error validating admin role:', error);
    return { valid: false };
  }
}

async function createSource(req: Request, authHeader: string) {
  const { name, homepage_url, feed_url, official = false } = await req.json();
  
  if (!name || !homepage_url) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: name, homepage_url' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data, error } = await supabase
    .from('sources')
    .insert({
      name,
      homepage_url,
      feed_url: feed_url || null,
      official,
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating source:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, source: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function enqueueItem(req: Request, authHeader: string) {
  const { source_id, url } = await req.json();
  
  if (!source_id || !url) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: source_id, url' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Use upsert to handle ON CONFLICT DO NOTHING behavior
  const { data, error } = await supabase
    .from('ingestion_queue')
    .upsert({
      source_id,
      url,
      status: 'pending',
      tries: 0,
    }, {
      onConflict: 'url',
      ignoreDuplicates: true
    })
    .select();

  if (error) {
    console.error('Error enqueuing item:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const wasInserted = data && data.length > 0;
  
  return new Response(JSON.stringify({ 
    success: true, 
    inserted: wasInserted,
    message: wasInserted ? 'Item enqueued successfully' : 'Item already exists in queue'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function retryQueueItem(req: Request, authHeader: string) {
  const { queue_id } = await req.json();
  
  if (!queue_id) {
    return new Response(JSON.stringify({ 
      error: 'Missing required field: queue_id' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // First get the current tries count
  const { data: currentItem, error: fetchError } = await supabase
    .from('ingestion_queue')
    .select('tries')
    .eq('id', queue_id)
    .single();

  if (fetchError) {
    console.error('Error fetching queue item:', fetchError);
    return new Response(JSON.stringify({ error: 'Queue item not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update status to pending and increment tries
  const { data, error } = await supabase
    .from('ingestion_queue')
    .update({
      status: 'pending',
      tries: currentItem.tries + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', queue_id)
    .select()
    .single();

  if (error) {
    console.error('Error retrying queue item:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    item: data,
    message: `Queue item ${queue_id} set to retry (attempt ${data.tries})`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate admin role
  const authHeader = req.headers.get('Authorization');
  const { valid } = await validateAdminRole(authHeader);
  
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Route by pathname - handle both direct and function paths
  const url = new URL(req.url);
  let pathname = url.pathname;
  
  // Extract the actual endpoint from Supabase function path
  if (pathname.startsWith('/functions/v1/admin-api/')) {
    pathname = pathname.replace('/functions/v1/admin-api', '');
  }
  
  console.log('Routing to pathname:', pathname);

  try {
    switch (pathname) {
      case '/sources':
        return await createSource(req, authHeader!);
      
      case '/enqueue':
        return await enqueueItem(req, authHeader!);
      
      case '/retry':
        return await retryQueueItem(req, authHeader!);
      
      default:
        return new Response(JSON.stringify({ 
          error: 'Not found',
          pathname: pathname,
          available_endpoints: ['/sources', '/enqueue', '/retry']
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in admin-api function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});