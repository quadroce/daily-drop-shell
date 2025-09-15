import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Topic {
  slug: string;
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

// XML Generation Helpers
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

  const urlEntries = urls.map(url => buildUrlEntry(url)).join('\n');
  return [xmlHeader, urlsetOpen, urlEntries, urlsetClose].join('\n');
}

function buildSitemapIndex(sitemaps: { loc: string; lastmod?: string }[]): string {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const sitemapIndexOpen = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const sitemapIndexClose = '</sitemapindex>';

  const sitemapEntries = sitemaps.map(sitemap => {
    const entries = [`    <loc>${escapeXml(sitemap.loc)}</loc>`];
    if (sitemap.lastmod) {
      entries.push(`    <lastmod>${sitemap.lastmod}</lastmod>`);
    }
    return `  <sitemap>\n${entries.join('\n')}\n  </sitemap>`;
  }).join('\n');

  return [xmlHeader, sitemapIndexOpen, sitemapEntries, sitemapIndexClose].join('\n');
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

function gzipCompress(data: string): Uint8Array {
  // For simplicity, we'll skip gzip compression in this implementation
  // In production, you could use a compression library
  return new TextEncoder().encode(data);
}

// Date utilities for Rome timezone
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

  // Add topics index if it exists
  urls.push({
    loc: `${baseUrl}/topics`,
    changefreq: 'daily',
    priority: 0.9,
    lastmod: now
  });

  return urls;
}

async function generateTopicsSitemap(supabase: any, baseUrl: string): Promise<{ urls: SitemapUrl[]; count: number }> {
  const { data: topics, error } = await supabase
    .from('topics')
    .select('slug')
    .eq('is_active', true)
    .order('slug');

  if (error) {
    console.error('Error fetching topics:', error);
    return { urls: [], count: 0 };
  }

  const urls: SitemapUrl[] = [];

  for (const topic of topics) {
    // Topic landing page
    urls.push({
      loc: `${baseUrl}/topics/${topic.slug}`,
      changefreq: 'daily',
      priority: 0.8,
      lastmod: new Date().toISOString()
    });

    // Topic archive page
    urls.push({
      loc: `${baseUrl}/topics/${topic.slug}/archive`,
      changefreq: 'weekly',
      priority: 0.6,
      lastmod: new Date().toISOString()
    });
  }

  return { urls, count: topics.length };
}

async function generateTopicsArchiveSitemap(supabase: any, baseUrl: string): Promise<{ urls: SitemapUrl[]; count: number }> {
  const { startDate, endDate } = getRomeDateRange90Days();
  
  // Get all active topics
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('slug')
    .eq('is_active', true);

  if (topicsError) {
    console.error('Error fetching topics for archives:', topicsError);
    return { urls: [], count: 0 };
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

  return { urls, count: urls.length };
}

async function uploadToStorage(supabase: any, path: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('public-sitemaps')
      .upload(path, content, {
        contentType: 'application/xml',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading ${path}:`, error);
      return false;
    }

    console.log(`Successfully uploaded ${path}`);
    return true;
  } catch (error) {
    console.error(`Exception uploading ${path}:`, error);
    return false;
  }
}

async function pingSearchEngines(baseUrl: string): Promise<{ google: boolean; bing: boolean }> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const results = { google: false, bing: false };

  // Ping Google
  try {
    const googleResponse = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
    results.google = googleResponse.ok;
    console.log('Google ping result:', googleResponse.status);
  } catch (error) {
    console.error('Error pinging Google:', error);
  }

  // Ping Bing
  try {
    const bingResponse = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
    results.bing = bingResponse.ok;
    console.log('Bing ping result:', bingResponse.status);
  } catch (error) {
    console.error('Error pinging Bing:', error);
  }

  return results;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const baseUrl = 'https://dailydrops.cloud'; // TODO: Make this configurable
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the start of sitemap generation
    const { data: runRecord } = await supabase
      .from('sitemap_runs')
      .insert({
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    const runId = runRecord?.id;

    try {
      console.log('Starting sitemap generation...');

      // Check for recent generations to prevent duplicates
      const { data: recentRuns } = await supabase
        .from('sitemap_runs')
        .select('id, started_at, success')
        .gte('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('started_at', { ascending: false })
        .limit(1);

      if (recentRuns && recentRuns.length > 0 && recentRuns[0].success !== false) {
        console.log('Skipping generation: recent run found within 5 minutes');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Sitemap generation skipped: recent run detected',
            recentRun: recentRuns[0]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      // Generate all sitemaps
      const coreUrls = await generateCoreSitemap(baseUrl);
      const { urls: topicUrls, count: topicsCount } = await generateTopicsSitemap(supabase, baseUrl);
      const { urls: archiveUrls, count: archiveCount } = await generateTopicsArchiveSitemap(supabase, baseUrl);

      // Build XML content
      const coreXml = buildSitemap(coreUrls);
      const topicsXml = buildSitemap(topicUrls);
      const archiveXml = buildSitemap(archiveUrls);

      // Build sitemap index
      const now = new Date().toISOString();
      const sitemapIndex = buildSitemapIndex([
        { loc: `${baseUrl}/sitemap-proxy/sitemaps/core.xml`, lastmod: now },
        { loc: `${baseUrl}/sitemap-proxy/sitemaps/topics.xml`, lastmod: now },
        { loc: `${baseUrl}/sitemap-proxy/sitemaps/topics-archive.xml`, lastmod: now }
      ]);

      // Upload all files to storage
      const uploadResults = await Promise.all([
        uploadToStorage(supabase, 'sitemap.xml', sitemapIndex),
        uploadToStorage(supabase, 'sitemaps/core.xml', coreXml),
        uploadToStorage(supabase, 'sitemaps/topics.xml', topicsXml),
        uploadToStorage(supabase, 'sitemaps/topics-archive.xml', archiveXml)
      ]);

      const allUploadsSuccessful = uploadResults.every(result => result);

      if (!allUploadsSuccessful) {
        throw new Error('Some sitemap uploads failed');
      }

      // Ping search engines
      const pingResults = await pingSearchEngines(baseUrl);

      // Update run record with success
      await supabase
        .from('sitemap_runs')
        .update({
          completed_at: new Date().toISOString(),
          success: true,
          total_urls: coreUrls.length + topicUrls.length + archiveUrls.length,
          topics_count: topicsCount,
          archive_urls_count: archiveCount,
          google_ping_success: pingResults.google,
          bing_ping_success: pingResults.bing
        })
        .eq('id', runId);

      console.log('Sitemap generation completed successfully');
      console.log(`Generated ${coreUrls.length + topicUrls.length + archiveUrls.length} total URLs`);
      console.log(`Topics: ${topicsCount}, Archive URLs: ${archiveCount}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Sitemap generated successfully',
          stats: {
            totalUrls: coreUrls.length + topicUrls.length + archiveUrls.length,
            topicsCount,
            archiveUrlsCount: archiveCount,
            googlePingSuccess: pingResults.google,
            bingPingSuccess: pingResults.bing
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } catch (error) {
      console.error('Sitemap generation failed:', error);

      // Update run record with failure
      if (runId) {
        await supabase
          .from('sitemap_runs')
          .update({
            completed_at: new Date().toISOString(),
            success: false,
            error_message: error.message
          })
          .eq('id', runId);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});