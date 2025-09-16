import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildSitemapIndex(sitemaps: { loc: string; lastmod?: string }[]): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const sitemapIndexOpen = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const sitemapIndexClose = '</sitemapindex>';
  
  const sitemapEntries = sitemaps.map(sitemap => {
    const entries = [`    <loc>${sitemap.loc}</loc>`];
    if (sitemap.lastmod) {
      entries.push(`    <lastmod>${sitemap.lastmod}</lastmod>`);
    }
    return `  <sitemap>\n${entries.join('\n')}\n  </sitemap>`;
  }).join('\n');
  
  return [xmlHeader, sitemapIndexOpen, sitemapEntries, sitemapIndexClose].join('\n');
}

async function logSitemapGeneration(supabase: any, path: string, count: number, duration: number): Promise<void> {
  try {
    await supabase
      .from('sitemap_runs')
      .insert({
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        success: true,
        total_urls: count
      });
  } catch (error) {
    console.warn('Failed to log sitemap generation:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('Serving sitemap index request...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const baseUrl = 'https://dailydrops.cloud';

    // Generate sitemap index
    const now = new Date().toISOString();
    const sitemapIndex = buildSitemapIndex([
      { loc: `${baseUrl}/sitemaps/core.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemaps/topics.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemaps/topics-archive.xml`, lastmod: now }
    ]);
    
    const duration = Date.now() - startTime;
    
    // Log sitemap generation
    await logSitemapGeneration(supabase, 'sitemap.xml', 3, duration);

    return new Response(sitemapIndex, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Error generating sitemap index:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate sitemap index' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});