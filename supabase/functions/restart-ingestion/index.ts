import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessResult {
  step: string;
  success: boolean;
  result?: any;
  error?: string;
  duration_ms: number;
}

async function callFunction(functionName: string, body: any = {}): Promise<ProcessResult> {
  const startTime = performance.now();
  
  try {
    console.log(`Calling ${functionName} with body:`, body);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const duration_ms = performance.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        step: functionName,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration_ms
      };
    }
    
    const result = await response.json();
    
    return {
      step: functionName,
      success: true,
      result,
      duration_ms
    };
    
  } catch (error) {
    const duration_ms = performance.now() - startTime;
    return {
      step: functionName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting ingestion restart process...');
    const overallStart = performance.now();
    
    const results: ProcessResult[] = [];
    
    // Step 1: Fetch new RSS feeds
    console.log('📡 Step 1: Fetching RSS feeds...');
    const rssResult = await callFunction('fetch-rss', {});
    results.push(rssResult);
    
    if (rssResult.success) {
      console.log(`✅ RSS fetch completed: ${rssResult.result?.enqueued || 0} new items enqueued`);
    } else {
      console.log(`❌ RSS fetch failed: ${rssResult.error}`);
    }
    
    // Step 2: Process ingestion queue (larger batch to clear backlog)
    console.log('⚙️ Step 2: Processing ingestion queue...');
    const queueResult = await callFunction('ingest-queue', { limit: 50 });
    results.push(queueResult);
    
    if (queueResult.success) {
      console.log(`✅ Queue processing completed: ${queueResult.result?.processed || 0} processed, ${queueResult.result?.done || 0} successful`);
    } else {
      console.log(`❌ Queue processing failed: ${queueResult.error}`);
    }
    
    // Step 3: Tag new drops
    console.log('🏷️ Step 3: Tagging drops...');
    const tagResult = await callFunction('tag-drops', { batch_size: 30, concurrent_requests: 2 });
    results.push(tagResult);
    
    if (tagResult.success) {
      console.log(`✅ Drop tagging completed: ${tagResult.result?.tagged || 0} articles tagged`);
    } else {
      console.log(`❌ Drop tagging failed: ${tagResult.error}`);
    }
    
    const overallDuration = performance.now() - overallStart;
    
    // Summary
    const summary = {
      success: results.every(r => r.success),
      total_duration_ms: Math.round(overallDuration),
      steps: results,
      summary: {
        rss_feeds_processed: rssResult.success ? rssResult.result?.sources || 0 : 0,
        new_items_enqueued: rssResult.success ? rssResult.result?.enqueued || 0 : 0,
        queue_items_processed: queueResult.success ? queueResult.result?.processed || 0 : 0,
        queue_items_successful: queueResult.success ? queueResult.result?.done || 0 : 0,
        articles_tagged: tagResult.success ? tagResult.result?.tagged || 0 : 0,
      }
    };
    
    console.log('🏁 Ingestion restart process completed:', summary);
    
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in restart-ingestion function:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      total_duration_ms: 0,
      steps: [],
      summary: {}
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
USAGE:

# Restart the entire ingestion process
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/restart-ingestion \
  -H "Content-Type: application/json"

This function will:
1. Fetch new RSS feeds and enqueue items
2. Process the ingestion queue (50 items)  
3. Tag new drops (30 items, 2 concurrent requests)
*/