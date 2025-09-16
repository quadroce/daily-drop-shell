import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { XMLParser } from "npm:fast-xml-parser";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Source {
  id: number;
  name: string;
  feed_url: string;
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
      return entries.map(entry => ({
        title: entry.title?.['#text'] || entry.title,
        link: entry.link?.['@_href'] || entry.link,
        published: entry.published || entry.updated
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Failed to parse XML:', error);
    return [];
  }
}

// Fetch and process a single RSS feed
async function processFeed(source: Source): Promise<FeedResult> {
  const result: FeedResult = {
    sourceId: source.id,
    sourceName: source.name,
    items: 0,
    errors: []
  };

  try {
    console.log(`Fetching RSS feed for source ${source.id}: ${source.feed_url}`);
    
    const response = await fetch(source.feed_url, {
      headers: {
        'User-Agent': 'DailyDropsBot/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      result.errors.push(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      return result;
    }

    const xmlContent = await response.text();
    const items = parseFeed(xmlContent);
    
    console.log(`Parsed ${items.length} items from ${source.name}`);

    // Enqueue each item
    const enqueuePromises = items.map(async (item) => {
      if (!item.link) return null;
      
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
            'apikey': SERVICE_ROLE_KEY,
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
        result.errors.push(`Error enqueuing ${item.link}: ${error.message}`);
        return false;
      }
    });

    await Promise.all(enqueuePromises);
    
  } catch (error) {
    result.errors.push(`Error processing feed: ${error.message}`);
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
    
    // NEW: Pagination parameters to prevent timeouts
    const offsetParam = parseInt(url.searchParams.get('offset') || '0', 10);
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10); // Max 50 sources per execution
    
    console.log(`Fetching RSS feeds (offset: ${offsetParam}, limit: ${limitParam})${sourceIdParam ? ` for source ${sourceIdParam}` : ' for active sources'}`);

    // Build query for active sources with feed_url and pagination
    let sourcesQuery = `${SUPABASE_URL}/rest/v1/sources?status=eq.active&feed_url=not.is.null&select=id,name,feed_url&order=id.asc`;
    
    if (sourceIdParam) {
      sourcesQuery += `&id=eq.${sourceIdParam}`;
    } else {
      // Add pagination only when not fetching a specific source
      sourcesQuery += `&offset=${offsetParam}&limit=${limitParam}`;
    }

    // Fetch active sources with RSS feeds
    const sourcesResponse = await fetch(sourcesQuery, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!sourcesResponse.ok) {
      const errorText = await sourcesResponse.text();
      console.error('Failed to fetch sources:', errorText);
      throw new Error(`Failed to fetch sources: ${sourcesResponse.status} ${errorText}`);
    }

    const sources: Source[] = await sourcesResponse.json();
    console.log(`Found ${sources.length} sources to process (offset: ${offsetParam})`);

    if (sources.length === 0) {
      return new Response(JSON.stringify({ 
        sources: 0, 
        enqueued: 0, 
        offset: offsetParam,
        has_more: false,
        message: sources.length === 0 && offsetParam === 0 ? 'No active sources with RSS feeds found' : 'No more sources to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process feeds in small batches to avoid CPU time limits  
    const BATCH_SIZE = 3; // Process 3 sources at a time
    const results: FeedResult[] = [];
    
    console.log(`Processing ${sources.length} sources in batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sources.length / BATCH_SIZE)} (${batch.length} sources)`);
      
      const batchResults = await Promise.all(
        batch.map(source => processFeed(source))
      );
      
      results.push(...batchResults);
      
      // Small delay between batches to prevent CPU exhaustion
      if (i + BATCH_SIZE < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
    const hasMore = sources.length === limitParam; // If we got exactly the limit, there might be more

    return new Response(JSON.stringify({
      sources: sources.length,
      enqueued: totalEnqueued,
      offset: offsetParam,
      limit: limitParam,
      has_more: hasMore,
      next_offset: hasMore ? offsetParam + limitParam : null,
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