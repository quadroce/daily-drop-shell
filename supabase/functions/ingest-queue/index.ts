import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueueItem {
  id: number;
  source_id: number | null;
  url: string;
  status: string;
  tries: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ProcessResult {
  processed: number;
  done: number;
  error: number;
}

async function updateQueueItem(id: number, updates: Partial<QueueItem>) {
  console.log(`Updating queue item ${id} with:`, updates);
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ingestion_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      ...updates,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to update queue item ${id}:`, errorText);
    throw new Error(`Failed to update queue item: ${errorText}`);
  }
}

async function callScrapeOg(url: string, sourceId: number | null) {
  console.log(`Calling scrape-og for URL: ${url}`);
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/scrape-og`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      source_id: sourceId,
    }),
  });

  const result = await response.json();
  
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  
  return result;
}

async function processQueueItems(limit = 20): Promise<ProcessResult> {
  console.log(`Starting queue processing with limit: ${limit}`);
  
  // 1. Pick up to N rows with FOR UPDATE SKIP LOCKED
  const fetchResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/ingestion_queue?status=eq.pending&order=created_at.asc&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
      },
    }
  );

  if (!fetchResponse.ok) {
    const errorText = await fetchResponse.text();
    console.error('Failed to fetch queue items:', errorText);
    throw new Error(`Failed to fetch queue items: ${errorText}`);
  }

  const queueItems: QueueItem[] = await fetchResponse.json();
  console.log(`Found ${queueItems.length} pending items to process`);

  if (queueItems.length === 0) {
    return { processed: 0, done: 0, error: 0 };
  }

  const result: ProcessResult = { processed: 0, done: 0, error: 0 };

  // Process items in batches of 3 for controlled concurrency
  const batchSize = 3;
  for (let i = 0; i < queueItems.length; i += batchSize) {
    const batch = queueItems.slice(i, i + batchSize);
    
    const promises = batch.map(async (item) => {
      try {
        console.log(`Processing item ${item.id}: ${item.url}`);
        
        // 2. Set status to 'processing' and increment tries
        await updateQueueItem(item.id, {
          status: 'processing',
          tries: item.tries + 1,
        });

        // 3. Call scrape-og function
        await callScrapeOg(item.url, item.source_id);
        
        // 4. On success, set status to 'done'
        await updateQueueItem(item.id, {
          status: 'done',
          error: null,
        });
        
        console.log(`Successfully processed item ${item.id}`);
        return { success: true, id: item.id };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process item ${item.id}:`, errorMessage);
        
        // 5. On failure, handle retry logic
        const newTries = item.tries + 1;
        
        if (newTries < 5) {
          // Set back to pending for retry
          await updateQueueItem(item.id, {
            status: 'pending',
            error: errorMessage,
          });
          console.log(`Item ${item.id} will be retried (attempt ${newTries}/5)`);
        } else {
          // Max tries reached, set to error
          await updateQueueItem(item.id, {
            status: 'error',
            error: errorMessage,
          });
          console.log(`Item ${item.id} failed permanently after ${newTries} attempts`);
        }
        
        return { success: false, id: item.id, error: errorMessage };
      }
    });

    // Wait for current batch to complete
    const batchResults = await Promise.allSettled(promises);
    
    // Count results
    for (const promiseResult of batchResults) {
      result.processed++;
      
      if (promiseResult.status === 'fulfilled') {
        if (promiseResult.value.success) {
          result.done++;
        } else {
          result.error++;
        }
      } else {
        result.error++;
        console.error('Promise rejected:', promiseResult.reason);
      }
    }
  }

  console.log('Processing complete:', result);
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let limit = 20;

    // Parse limit from request body if POST
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.limit && typeof body.limit === 'number') {
          limit = Math.min(Math.max(1, body.limit), 100); // Clamp between 1-100
        }
      } catch (e) {
        // Invalid JSON, use default limit
        console.log('Invalid JSON in POST body, using default limit');
      }
    }

    // Process queue items
    const result = await processQueueItems(limit);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ingest-queue function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      processed: 0,
      done: 0,
      error: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});