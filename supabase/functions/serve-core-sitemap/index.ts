import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function buildUrlEntry(url: SitemapUrl): string {
  const entries = [`    <loc>${escapeXml(url.loc)}</loc>`];
  
  if (url.lastmod) {
    entries.push(`    <lastmod>${url.lastmod}</lastmod>`);
  }
  if (url.changefreq) {
    entries.push(`    <changefreq>${url.changefreq}</changefreq>`);
  }
  if (url.priority) {
    entries.push(`    <priority>${url.priority}</priority>`);
  }

  return `  <url>\n${entries.join('\n')}\n  </url>`;
}

function buildSitemap(urls: SitemapUrl[]): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const urlsetClose = '</urlset>';
  
  const urlEntries = urls.map(buildUrlEntry).join('\n');
  
  return [xmlHeader, urlsetOpen, urlEntries, urlsetClose].join('\n');
}

async function generateCoreSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = [];
  const now = new Date().toISOString();

  // Core static pages
  urls.push({
    loc: `${baseUrl}/`,
    changefreq: 'daily',
    priority: 1.0,
    lastmod: now
  });

  urls.push({
    loc: `${baseUrl}/pricing`,
    changefreq: 'weekly',
    priority: 0.8,
    lastmod: now
  });

  urls.push({
    loc: `${baseUrl}/topics`,
    changefreq: 'daily',
    priority: 0.9,
    lastmod: now
  });

  return urls;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Serving core sitemap request...');

  try {
    const baseUrl = 'https://dailydrops.cloud';
    
    // Generate core sitemap URLs
    const coreUrls = await generateCoreSitemap(baseUrl);
    
    // Build sitemap XML
    const sitemapXml = buildSitemap(coreUrls);

    return new Response(sitemapXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Error generating core sitemap:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate core sitemap' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});