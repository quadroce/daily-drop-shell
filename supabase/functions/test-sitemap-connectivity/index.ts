import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SitemapTestResult {
  url: string;
  status: 'success' | 'error';
  httpStatus?: number;
  contentType?: string;
  isValidXml?: boolean;
  urlCount?: number;
  error?: string;
  responseTime?: number;
}

async function testSitemapEndpoint(url: string): Promise<SitemapTestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Testing sitemap endpoint: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sitemap-Test-Bot/1.0'
      }
    });

    const responseTime = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    
    if (!response.ok) {
      return {
        url,
        status: 'error',
        httpStatus: response.status,
        contentType,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const content = await response.text();
    
    // Check if content is valid XML
    let isValidXml = false;
    let urlCount = 0;
    
    try {
      // Basic XML validation - check if it starts with XML declaration and has proper structure
      isValidXml = content.includes('<?xml') && 
                   (content.includes('<urlset') || content.includes('<sitemapindex'));
      
      // Count URLs or sitemaps
      if (content.includes('<loc>')) {
        urlCount = (content.match(/<loc>/g) || []).length;
      }
    } catch (xmlError) {
      isValidXml = false;
    }

    return {
      url,
      status: 'success',
      httpStatus: response.status,
      contentType,
      isValidXml,
      urlCount,
      responseTime
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      url,
      status: 'error',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = 'https://dailydrops.cloud';
    
    const endpoints = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-proxy/sitemaps/core.xml`,
      `${baseUrl}/sitemap-proxy/sitemaps/topics.xml`,
      `${baseUrl}/sitemap-proxy/sitemaps/topics-archive.xml`
    ];

    console.log(`Testing ${endpoints.length} sitemap endpoints...`);

    // Test all endpoints in parallel
    const results = await Promise.all(
      endpoints.map(url => testSitemapEndpoint(url))
    );

    const summary = {
      totalEndpoints: results.length,
      successCount: results.filter(r => r.status === 'success').length,
      errorCount: results.filter(r => r.status === 'error').length,
      totalUrls: results.reduce((sum, r) => sum + (r.urlCount || 0), 0),
      averageResponseTime: Math.round(
        results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length
      )
    };

    console.log(`Test completed: ${summary.successCount}/${summary.totalEndpoints} endpoints successful`);
    console.log(`Total URLs found: ${summary.totalUrls}`);
    console.log(`Average response time: ${summary.averageResponseTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Sitemap test failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});