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

function getRomeDateRange90Days(): { startDate: string; endDate: string } {
  const now = new Date();
  // Convert to Rome timezone (approximation)
  const romeOffset = 2; // UTC+2 (considering DST)
  const romeNow = new Date(now.getTime() + (romeOffset * 60 * 60 * 1000));
  
  const endDate = romeNow.toISOString().split('T')[0];
  
  const startDate = new Date(romeNow);
  startDate.setDate(startDate.getDate() - 89); // 90 days total including today
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate
  };
}

async function generateTopicsArchiveSitemap(supabase: any, baseUrl: string): Promise<SitemapUrl[]> {
  const { startDate, endDate } = getRomeDateRange90Days();
  
  // Get all active topics
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('slug')
    .eq('is_active', true);

  if (topicsError) {
    console.error('Error fetching topics for archives:', topicsError);
    return [];
  }

  const urls: SitemapUrl[] = [];
  
  // For each topic, generate archive URLs for the last 90 days
  for (const topic of topics) {
    // Check if there's actual content for specific dates
    const { data: drops } = await supabase
      .from('drops')
      .select('published_at')
      .contains('tags', [topic.slug])
      .gte('published_at', startDate)
      .lte('published_at', endDate)
      .order('published_at', { ascending: false });

    if (drops && drops.length > 0) {
      // Group by date and create archive URLs
      const dateSet = new Set();
      drops.forEach(drop => {
        if (drop.published_at) {
          const date = drop.published_at.split('T')[0];
          dateSet.add(date);
        }
      });

      dateSet.forEach(date => {
        urls.push({
          loc: `${baseUrl}/topics/${topic.slug}/${date}`,
          changefreq: 'monthly',
          priority: 0.4,
          lastmod: `${date}T00:00:00Z`
        });
      });
    }
  }

  return urls;
}

async function logSitemapGeneration(supabase: any, path: string, count: number, duration: number): Promise<void> {
  try {
    await supabase
      .from('sitemap_runs')
      .insert({
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        success: true,
        total_urls: count,
        archive_urls_count: count
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
  console.log('Serving topics archive sitemap request...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const baseUrl = 'https://dailydrops.cloud';

    // Generate topics archive sitemap URLs
    const archiveUrls = await generateTopicsArchiveSitemap(supabase, baseUrl);
    
    // Build sitemap XML
    const sitemapXml = buildSitemap(archiveUrls);
    const duration = Date.now() - startTime;
    
    // Log sitemap generation
    await logSitemapGeneration(supabase, 'sitemaps/topics-archive.xml', archiveUrls.length, duration);

    return new Response(sitemapXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Error generating topics archive sitemap:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate topics archive sitemap' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});