import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cacheHeaders = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
  'Content-Type': 'application/xml'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let storagePath: string;
    
    if (req.method === 'POST') {
      // Handle POST requests with path in body
      const body = await req.json();
      storagePath = body.path;
    } else {
      // Handle GET requests with path in URL
      const url = new URL(req.url);
      const pathname = url.pathname;
      
      // Extract sitemap filename from path
      // Expected paths: /sitemap-proxy/sitemap.xml, /sitemap-proxy/sitemaps/core.xml, etc.
      const pathParts = pathname.split('/').filter(p => p);
      
      if (pathParts.length < 2 || pathParts[0] !== 'sitemap-proxy') {
        return new Response('Invalid sitemap path', { 
          status: 400,
          headers: corsHeaders 
        });
      }

      // Build the storage path
      if (pathParts.length === 2) {
        // Root level sitemaps like /sitemap-proxy/sitemap.xml
        storagePath = pathParts[1];
      } else {
        // Nested sitemaps like /sitemap-proxy/sitemaps/core.xml
        storagePath = pathParts.slice(1).join('/');
      }
    }

    if (!storagePath) {
      return new Response('Missing sitemap path', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('Requesting sitemap from storage:', storagePath);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the sitemap file from storage
    const { data, error } = await supabase.storage
      .from('public-sitemaps')
      .download(storagePath);

    if (error) {
      console.error('Error downloading sitemap:', error);
      
      if (error.message?.includes('not found')) {
        return new Response('Sitemap not found', { 
          status: 404,
          headers: corsHeaders 
        });
      }
      
      return new Response('Error retrieving sitemap', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    if (!data) {
      return new Response('Sitemap not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Convert blob to text
    const xmlContent = await data.text();
    
    console.log(`Successfully served sitemap: ${storagePath}`);

    return new Response(xmlContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...cacheHeaders
      }
    });

  } catch (error) {
    console.error('Unexpected error in sitemap proxy:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders
    });
  }
});