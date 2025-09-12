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
  return [
    {
      loc: `${baseUrl}/`,
      changefreq: 'daily',
      priority: 1.0
    },
    {
      loc: `${baseUrl}/topics`,
      changefreq: 'daily',
      priority: 0.9
    },
    {
      loc: `${baseUrl}/search`,
      changefreq: 'weekly',
      priority: 0.7
    },
    {
      loc: `${baseUrl}/pricing`,
      changefreq: 'monthly',
      priority: 0.6
    }
  ];
}

async function generateTopicsSitemap(supabase: any, baseUrl: string): Promise<SitemapUrl[]> {
  const { data: topics, error } = await supabase
    .from('topics')
    .select('slug, updated_at')
    .eq('is_active', true)
    .order('slug');

  if (error) {
    console.error('Error fetching topics:', error);
    return [];
  }

  const urls: SitemapUrl[] = [];
  
  for (const topic of topics || []) {
    // Topic landing page
    urls.push({
      loc: `${baseUrl}/topics/${topic.slug}`,
      lastmod: topic.updated_at ? new Date(topic.updated_at).toISOString().split('T')[0] : undefined,
      changefreq: 'daily',
      priority: 0.8
    });

    // Topic archive page
    urls.push({
      loc: `${baseUrl}/topics/${topic.slug}/archive`,
      changefreq: 'weekly',
      priority: 0.6
    });

    // Get daily archive pages for this topic
    const { data: dates } = await supabase
      .from('content')
      .select('published_at')
      .contains('topic_slugs', [topic.slug])
      .not('published_at', 'is', null)
      .gte('published_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: false });

    if (dates) {
      const uniqueDates = [...new Set(dates.map(d => 
        new Date(d.published_at).toISOString().split('T')[0]
      ))];

      uniqueDates.forEach(date => {
        urls.push({
          loc: `${baseUrl}/topics/${topic.slug}/${date}`,
          lastmod: date,
          changefreq: 'monthly',
          priority: 0.4
        });
      });
    }
  }

  return urls;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Serving sitemap request...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const baseUrl = 'https://dailydrops.cloud';

    // Generate all sitemap URLs
    const coreUrls = await generateCoreSitemap(baseUrl);
    const topicUrls = await generateTopicsSitemap(supabase, baseUrl);
    
    const allUrls = [...coreUrls, ...topicUrls];
    
    // Build sitemap XML
    const sitemapXml = buildSitemap(allUrls);

    return new Response(sitemapXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('Error generating sitemap:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate sitemap' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});