import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.3";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Source {
  id: number;
  name: string;
  feed_url: string;
  source_health?: Array<{
    zero_article_attempts: number;
    last_zero_attempt_at: string | null;
    is_paused: boolean;
    consecutive_errors: number;
  }>;
}

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  published?: string;
  'dc:date'?: string;
}

interface FeedResult {
  sourceId: number;
  sourceName: string;
  items: number;
  errors: string[];
}

// Parse RSS/Atom feed and extract items
function parseFeed(xmlContent: string): RSSItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });
  
  try {
    const parsed = parser.parse(xmlContent);
    
    // Handle RSS 2.0
    if (parsed.rss && parsed.rss.channel && parsed.rss.channel.item) {
      const items = Array.isArray(parsed.rss.channel.item) 
        ? parsed.rss.channel.item 
        : [parsed.rss.channel.item];
      return items;
    }
    
    // Handle Atom
    if (parsed.feed && parsed.feed.entry) {
      const entries = Array.isArray(parsed.feed.entry) 
        ? parsed.feed.entry 
        : [parsed.feed.entry];
      return entries.map((entry: any) => {
        let linkUrl = null;
        
        // Handle different link formats in Atom feeds
        if (entry.link) {
          if (typeof entry.link === 'string') {
            // Simple string URL
            linkUrl = entry.link;
          } else if (Array.isArray(entry.link)) {
            // Array of link objects - find the main HTML link
            const htmlLink = entry.link.find((link: any) => 
              link['@_type'] === 'text/html' || 
              link['@_rel'] === 'alternate' ||
              !link['@_rel'] // No rel attribute usually means main link
            );
            linkUrl = htmlLink?.['@_href'] || entry.link[0]?.['@_href'];
          } else if (typeof entry.link === 'object') {
            // Single link object
            linkUrl = entry.link['@_href'] || entry.link.href;
          }
        }
        
        return {
          title: entry.title?.['#text'] || entry.title,
          link: linkUrl,
          published: entry.published || entry.updated
        };
      });
    }
    
    return [];
  } catch (error) {
    console.error('Failed to parse XML:', error);
    return [];
  }
}

// Update source health status and handle auto-elimination
async function updateSourceHealth(sourceId: number, isSuccess: boolean, articleCount: number = 0, errorType?: string) {
  try {
    if (isSuccess && articleCount === 0) {
      // Track zero article attempts
      await supabase
        .from('source_health')
        .upsert({
          source_id: sourceId,
          zero_article_attempts: 'zero_article_attempts + 1',
          last_zero_attempt_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'source_id'
        });

      // Check if source should be auto-eliminated
      const { data: healthData } = await supabase
        .from('source_health')
        .select('zero_article_attempts')
        .eq('source_id', sourceId)
        .single();

      if (healthData && healthData.zero_article_attempts >= 3) {
        // Auto-eliminate source after 3 failed attempts
        await supabase
          .from('sources')
          .update({ status: 'disabled' })
          .eq('id', sourceId);
        
        console.log(`🚫 Auto-eliminated source ${sourceId} after 3 zero-article attempts`);
      }
    } else if (isSuccess && articleCount > 0) {
      // Reset zero article attempts on successful article fetch
      await supabase
        .from('source_health')
        .upsert({
          source_id: sourceId,
          consecutive_errors: 0,
          zero_article_attempts: 0,
          last_zero_attempt_at: null,
          last_success_at: new Date().toISOString(),
          is_paused: false,
          paused_until: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'source_id'
        });
    } else if (!isSuccess) {
      // Handle errors
      await supabase
        .from('source_health')
        .upsert({
          source_id: sourceId,
          consecutive_errors: 'consecutive_errors + 1',
          error_type: errorType,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_paused: 'consecutive_errors >= 10',
          paused_until: 'CASE WHEN consecutive_errors >= 10 THEN now() + interval \'2 hours\' ELSE paused_until END'
        }, {
          onConflict: 'source_id'
        });
    }
  } catch (error) {
    console.warn(`Failed to update source health for ${sourceId}:`, error instanceof Error ? error.message : String(error));
  }
}

// Get intelligent delay based on error type
function getRetryDelay(errorStatus: number, attempt: number = 1): number {
  const baseDelay = 1000; // 1 second base
  
  switch (errorStatus) {
    case 429: // Too Many Requests
      return Math.min(60000, baseDelay * Math.pow(2, attempt)); // 1s, 2s, 4s, 8s, 16s, 32s, 60s max
    case 403: // Forbidden - longer delay
      return Math.min(300000, baseDelay * 10 * attempt); // 10s, 20s, 30s, up to 5 minutes
    case 500:
    case 502:
    case 503:
    case 504: // Server errors
      return Math.min(30000, baseDelay * 3 * attempt); // 3s, 6s, 9s, up to 30s
    default:
      return baseDelay * attempt; // 1s, 2s, 3s...
  }
}

// Fetch and process a single RSS feed with intelligent retry
async function processFeed(source: Source): Promise<FeedResult> {
  const result: FeedResult = {
    sourceId: source.id,
    sourceName: source.name,
    items: 0,
    errors: []
  };

  let attempt = 1;
  const maxRetries = 3;

  while (attempt <= maxRetries) {
    try {
      console.log(`Fetching RSS feed for source ${source.id} (attempt ${attempt}/${maxRetries}): ${source.feed_url}`);
      
      const response = await fetch(source.feed_url, {
        headers: {
          'User-Agent': 'DailyDropsBot/1.0',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorMsg = `Failed to fetch feed: ${response.status} ${response.statusText}`;
        
        // Check if we should retry based on status code
        const shouldRetry = attempt < maxRetries && (
          response.status === 429 || // Rate limited
          response.status >= 500 ||  // Server errors
          response.status === 503    // Service unavailable
        );

        if (shouldRetry) {
          const delay = getRetryDelay(response.status, attempt);
          console.log(`Will retry source ${source.id} after ${delay}ms (status: ${response.status})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        } else {
          // Permanent failure or max retries reached
          result.errors.push(errorMsg);
          await updateSourceHealth(source.id, false, response.status);
          return result;
        }
      }

      const xmlContent = await response.text();
      const items = parseFeed(xmlContent);
      
      console.log(`Parsed ${items.length} items from ${source.name}`);

      // Enqueue each item with better error handling
      const enqueuePromises = items.map(async (item) => {
        if (!item.link) return null;
        
        // Validate URL format to prevent malformed URLs from entering the queue
        try {
          new URL(item.link);
        } catch (urlError) {
          console.warn(`Skipping malformed URL: ${item.link}`);
          result.errors.push(`Malformed URL: ${item.link}`);
          return null;
        }
        
        const queueData = {
          url: item.link,
          source_id: source.id,
          status: 'pending',
          lang: null // Will be determined later
        };

        try {
          const enqueueResponse = await fetch(`${SUPABASE_URL}/rest/v1/ingestion_queue`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'apikey': SERVICE_ROLE_KEY!,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=ignore-duplicates',
            },
            body: JSON.stringify(queueData),
          });

          if (enqueueResponse.ok) {
            result.items++;
            return true;
          } else if (enqueueResponse.status === 409) {
            // Conflict - item already exists, which is fine
            return false;
          } else {
            const errorText = await enqueueResponse.text();
            result.errors.push(`Failed to enqueue ${item.link}: ${errorText}`);
            return false;
          }
        } catch (error) {
          result.errors.push(`Error enqueuing ${item.link}: ${error instanceof Error ? error.message : String(error)}`);
          return false;
        }
      });

      await Promise.all(enqueuePromises);
      
      // Update source health with article count for zero-article tracking
      await updateSourceHealth(source.id, true, result.items);
      break; // Success, exit retry loop
      
    } catch (error) {
      const isTimeout = (error instanceof Error && error.name === 'TimeoutError') || 
                       (error instanceof Error && error.message.includes('timeout'));
      const errorMsg = `Error processing feed: ${error instanceof Error ? error.message : String(error)}`;
      
      if (attempt < maxRetries && (isTimeout || (error instanceof Error && error.message.includes('network')))) {
        console.log(`Will retry source ${source.id} after network error (attempt ${attempt}/${maxRetries})`);
        const delay = getRetryDelay(500, attempt); // Treat as server error
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      } else {
        result.errors.push(errorMsg);
        await updateSourceHealth(source.id, false, isTimeout ? 408 : 500);
        break;
      }
    }
  }

  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting RSS fetch process...');
    
    const url = new URL(req.url);
    const sourceIdParam = url.searchParams.get('source_id');
    
    // Optimized pagination parameters to reduce WORKER_LIMIT errors
    const offsetParam = parseInt(url.searchParams.get('offset') || '0', 10);
    const limitParam = parseInt(url.searchParams.get('limit') || '25', 10); // Reduced from 80 to 25 to prevent resource limits
    
    console.log(`Fetching RSS feeds (offset: ${offsetParam}, limit: ${limitParam})${sourceIdParam ? ` for source ${sourceIdParam}` : ' for active sources'}`);

    // Now that foreign key exists, restore optimized nested query
    let sourcesQuery;
    
    if (sourceIdParam) {
      // Single source query
      sourcesQuery = supabase
        .from('sources')
        .select(`
          id, name, feed_url,
          source_health (
            zero_article_attempts,
            last_zero_attempt_at,
            is_paused,
            consecutive_errors
          )
        `)
        .eq('id', parseInt(sourceIdParam))
        .eq('status', 'active')
        .not('feed_url', 'is', null);
    } else {
      // Intelligent prioritization query
      sourcesQuery = supabase
        .from('sources')
        .select(`
          id, name, feed_url,
          source_health (
            zero_article_attempts,
            last_zero_attempt_at,
            is_paused,
            consecutive_errors
          )
        `)
        .eq('status', 'active')
        .not('feed_url', 'is', null)
        .range(offsetParam, offsetParam + limitParam - 1);
    }

    const { data: sourcesData, error: sourcesError } = await sourcesQuery;

    if (sourcesError) {
      console.error('Error fetching sources:', sourcesError);
      return new Response(JSON.stringify({ 
        sources: 0, 
        enqueued: 0, 
        error: 'Failed to fetch sources' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!sourcesData || sourcesData.length === 0) {
      return new Response(JSON.stringify({ 
        sources: 0, 
        enqueued: 0, 
        offset: offsetParam,
        has_more: false,
        message: offsetParam === 0 ? 'No active sources with RSS feeds found' : 'No more sources to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Intelligent prioritization: 
    // 1. PRIORITY: Sources with 0 articles and <= 3 attempts (give new sources chances)
    // 2. NORMAL: All other active sources (by health)
    const sources = sourcesData
      .filter(source => !source.source_health?.[0]?.is_paused)
      .sort((a, b) => {
        const aHealth = a.source_health?.[0];
        const bHealth = b.source_health?.[0];
        
        const aAttempts = aHealth?.zero_article_attempts || 0;
        const bAttempts = bHealth?.zero_article_attempts || 0;
        
        // Priority sources: sources with 0+ attempts but <= 3 (give chances to prove themselves)
        const aPriority = aAttempts > 0 && aAttempts <= 3;
        const bPriority = bAttempts > 0 && bAttempts <= 3;
        
        if (aPriority && !bPriority) return -1; // Priority sources first
        if (!aPriority && bPriority) return 1;
        
        // Within same priority level, prefer fewer consecutive errors
        return (aHealth?.consecutive_errors || 0) - (bHealth?.consecutive_errors || 0);
      });
      
    console.log(`Found ${sources.length} sources to process (${sources.filter(s => {
      const health = s.source_health?.[0];
      const attempts = health?.zero_article_attempts || 0;
      return attempts > 0 && attempts <= 3;
    }).length} priority sources with 0 articles)`);

    if (sources.length === 0) {
      return new Response(JSON.stringify({ 
        sources: 0, 
        enqueued: 0, 
        offset: offsetParam,
        has_more: false,
        message: 'All sources are paused or disabled'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process feeds in conservative batches to prevent WORKER_LIMIT errors
    const BATCH_SIZE = 3; // Reduced from 5 to 3 sources at a time to reduce resource usage
    const results: FeedResult[] = [];
    
    console.log(`Processing ${sources.length} sources in batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sources.length / BATCH_SIZE)} (${batch.length} sources)`);
      
      const batchResults = await Promise.all(
        batch.map(source => processFeed(source))
      );
      
      results.push(...batchResults);
      
      // Increased delay between batches to prevent WORKER_LIMIT errors
      if (i + BATCH_SIZE < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 1200)); // Increased from 500ms to 1200ms to reduce resource pressure
      }
    }

    const totalEnqueued = results.reduce((sum, result) => sum + result.items, 0);
    const allErrors = results.flatMap(result => 
      result.errors.map(error => `${result.sourceName}: ${error}`)
    );

    console.log(`Processed ${sources.length} sources, enqueued ${totalEnqueued} items (offset: ${offsetParam})`);
    if (allErrors.length > 0) {
      console.warn('Errors encountered:', allErrors);
    }

    // Determine if there are more sources to process
    const hasMore = sourcesData.length === limitParam; // If we got exactly the limit, there might be more

    return new Response(JSON.stringify({
      sources: sources.length,
      enqueued: totalEnqueued,
      offset: offsetParam,
      limit: limitParam,
      has_more: hasMore,
      next_offset: hasMore ? offsetParam + limitParam : null,
      priority_sources: sources.filter(s => {
        const health = s.source_health?.[0];
        const attempts = health?.zero_article_attempts || 0;
        return attempts > 0 && attempts <= 3;
      }).length,
      results: results.map(r => ({
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        items: r.items,
        errorCount: r.errors.length
      })),
      errors: allErrors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-rss function:', error);
    return new Response(JSON.stringify({ 
      sources: 0,
      enqueued: 0,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
CURL EXAMPLES:

# Fetch all active RSS feeds
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/fetch-rss \
  -H "Content-Type: application/json"

# Fetch RSS for specific source
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/fetch-rss?source_id=1" \
  -H "Content-Type: application/json"

# GET request (same as POST for this function)
curl -X GET https://qimelntuxquptqqynxzv.supabase.co/functions/v1/fetch-rss \
  -H "Content-Type: application/json"
*/