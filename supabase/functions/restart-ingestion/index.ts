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
    const overallStart = performance.now();
    
    // Parse request parameters
    let isAutoTrigger = false;
    let skipRssFetch = false;
    let isCronTrigger = false;
    
    try {
      const body = await req.json();
      isAutoTrigger = body.auto_recovery || body.cron_trigger || false;
      isCronTrigger = body.cron_trigger || false;
      
      console.log(`🚀 Starting ingestion restart process... ${isCronTrigger ? '[CRON]' : '[MANUAL]'}`);
      
      // Skip RSS fetch if it recently failed to prevent worker limit issues
      if (isAutoTrigger) {
        // For auto triggers, skip RSS more often to prevent overload
        const skipRssChance = Math.random() < 0.6; // Skip RSS 60% of the time for auto triggers
        skipRssFetch = skipRssChance;
        console.log(`🤖 Auto-trigger detected, ${skipRssFetch ? 'skipping' : 'including'} RSS fetch for reliability...`);
      }
    } catch (e) {
      console.log('🚀 Starting ingestion restart process... [NO BODY]');
      // No body, continue with defaults
    }

    const results: ProcessResult[] = [];
    
    // Add execution tracking for cron jobs
    if (isCronTrigger) {
      console.log('📊 Cron trigger detected - logging execution for monitoring');
    }
    
    // Step 1: Fetch new RSS feeds (skip if problematic)
    if (!skipRssFetch) {
      console.log('📡 Step 1: Fetching RSS feeds...');
      const rssResult = await callFunction('fetch-rss', {});
      results.push(rssResult);
      
      if (rssResult.success) {
        console.log(`✅ RSS fetch completed: ${rssResult.result?.enqueued || 0} new items enqueued`);
      } else if (rssResult.recoverable) {
        console.log(`⚠️ RSS fetch failed but recoverable: ${rssResult.error}`);
      } else {
        console.log(`❌ RSS fetch failed: ${rssResult.error}`);
      }
    } else {
      console.log('📡 Skipping RSS fetch to prevent worker limits');
    }
    
    // Step 2: Process ingestion queue (always try this)
    console.log('⚙️ Step 2: Processing ingestion queue...');
    const queueLimit = isAutoTrigger ? 30 : 50; // Smaller batches for auto-trigger
    const queueResult = await callFunction('ingest-queue', { limit: queueLimit });
    results.push(queueResult);
    
    if (queueResult.success) {
      console.log(`✅ Queue processing completed: ${queueResult.result?.processed || 0} processed, ${queueResult.result?.done || 0} successful`);
    } else {
      console.log(`❌ Queue processing failed: ${queueResult.error}`);
    }
    
    // Step 3: Tag new drops (always try, even if no new items processed)
    console.log('🏷️ Step 3: Tagging drops...');
    const tagBatchSize = isAutoTrigger ? 50 : 75; // Larger batches to clear backlog faster
    const tagResult = await callFunction('tag-drops', { 
      batch_size: tagBatchSize, 
      concurrent_requests: isAutoTrigger ? 3 : 4 // More concurrent requests for faster processing
    });
    results.push(tagResult);
    
    if (tagResult.success) {
      console.log(`✅ Drop tagging completed: ${tagResult.result?.tagged || 0} articles tagged`);
    } else {
      console.log(`❌ Drop tagging failed: ${tagResult.error}`);
    }
    
    const overallDuration = performance.now() - overallStart;
    
    // Determine overall success (at least queue processing should work)
    const hasQueueSuccess = results.some(r => r.step === 'ingest-queue' && r.success);
    const overallSuccess = hasQueueSuccess; // Success if we can at least process queue
    
    // Summary
    const summary = {
      success: overallSuccess,
      total_duration_ms: Math.round(overallDuration),
      auto_trigger: isAutoTrigger,
      cron_trigger: isCronTrigger,
      steps: results,
      summary: {
        rss_feeds_processed: results.find(r => r.step === 'fetch-rss')?.result?.sources || 0,
        new_items_enqueued: results.find(r => r.step === 'fetch-rss')?.result?.enqueued || 0,
        queue_items_processed: results.find(r => r.step === 'ingest-queue')?.result?.processed || 0,
        queue_items_successful: results.find(r => r.step === 'ingest-queue')?.result?.done || 0,
        articles_tagged: results.find(r => r.step === 'tag-drops')?.result?.tagged || 0,
      }
    };
    
    console.log(`🏁 Ingestion restart process completed ${isCronTrigger ? '[CRON]' : '[MANUAL]'}:`, summary);
    
    // Log to database for monitoring if this was a cron trigger
    if (isCronTrigger) {
      try {
        const logResponse = await fetch(`${SUPABASE_URL}/rest/v1/cron_execution_log`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            job_name: 'restart-ingestion-cron',
            success: overallSuccess,
            response_status: 200,
            response_body: JSON.stringify(summary)
          }),
        });
        
        if (!logResponse.ok) {
          console.warn('⚠️ Failed to log cron execution:', await logResponse.text());
        } else {
          console.log('📝 Cron execution logged successfully');
        }
      } catch (logError) {
        console.warn('⚠️ Failed to log cron execution:', logError);
      }
    }
    
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