import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SitemapTestResult {
  url: string;
  accessible: boolean;
  isValidXml: boolean;
  lastModified?: string;
  size?: number;
  error?: string;
}

interface IndexNowResult {
  success: boolean;
  statusCode: number;
  submitted: number;
  error?: string;
}

interface TestResults {
  indexnow: IndexNowResult;
  sitemaps: SitemapTestResult[];
  summary: {
    total_sitemaps: number;
    accessible_sitemaps: number;
    valid_xml_sitemaps: number;
    indexnow_success: boolean;
  };
}

async function testSitemapAccessibility(url: string): Promise<SitemapTestResult> {
  try {
    console.log(`🔍 Testing sitemap: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'DailyDrops-SitemapTester/1.0'
      }
    });

    if (!response.ok) {
      return {
        url,
        accessible: false,
        isValidXml: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const content = await response.text();
    const lastModified = response.headers.get('last-modified');
    
    // Basic XML validation
    const isValidXml = content.includes('<?xml') && 
                      content.includes('<urlset') && 
                      content.includes('</urlset>');

    return {
      url,
      accessible: true,
      isValidXml,
      lastModified: lastModified || undefined,
      size: content.length
    };

  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error);
    return {
      url,
      accessible: false,
      isValidXml: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  try {
    console.log(`📤 Submitting ${urls.length} URLs to IndexNow via integration...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.functions.invoke('indexnow-integration', {
      body: { 
        urls, 
        trigger: 'sitemap-test' 
      }
    });

    if (error) {
      console.error('IndexNow integration error:', error);
      return {
        success: false,
        statusCode: 500,
        submitted: 0,
        error: error.message
      };
    }

    return {
      success: data?.success || false,
      statusCode: data?.statusCode || 500,
      submitted: data?.submitted || 0
    };

  } catch (error) {
    console.error('IndexNow submission error:', error);
    return {
      success: false,
      statusCode: 500,
      submitted: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting sitemap submission test...');

    const sitemapUrls = [
      'https://dailydrops.cloud/sitemap.xml',
      'https://dailydrops.cloud/sitemaps/core.xml',
      'https://dailydrops.cloud/sitemaps/topics.xml',
      'https://dailydrops.cloud/sitemaps/topics-archive.xml'
    ];

    // Test sitemap accessibility in parallel
    console.log('🔍 Testing sitemap accessibility...');
    const sitemapTests = await Promise.all(
      sitemapUrls.map(url => testSitemapAccessibility(url))
    );

    // Submit accessible sitemaps to IndexNow
    const accessibleUrls = sitemapTests
      .filter(test => test.accessible)
      .map(test => test.url);

    let indexnowResult: IndexNowResult;
    
    if (accessibleUrls.length > 0) {
      console.log(`📤 Submitting ${accessibleUrls.length} accessible sitemaps to IndexNow...`);
      indexnowResult = await submitToIndexNow(accessibleUrls);
    } else {
      console.warn('⚠️ No accessible sitemaps found, skipping IndexNow submission');
      indexnowResult = {
        success: false,
        statusCode: 400,
        submitted: 0,
        error: 'No accessible sitemaps found'
      };
    }

    // Compile results
    const results: TestResults = {
      indexnow: indexnowResult,
      sitemaps: sitemapTests,
      summary: {
        total_sitemaps: sitemapTests.length,
        accessible_sitemaps: sitemapTests.filter(t => t.accessible).length,
        valid_xml_sitemaps: sitemapTests.filter(t => t.isValidXml).length,
        indexnow_success: indexnowResult.success
      }
    };

    console.log('✅ Sitemap test completed:', {
      accessible: results.summary.accessible_sitemaps,
      total: results.summary.total_sitemaps,
      indexnow: results.summary.indexnow_success
    });

    return new Response(
      JSON.stringify(results, null, 2),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Sitemap test error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});