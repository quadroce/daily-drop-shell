import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
  errors: number;
  details: Array<{
    id: number;
    url: string;
    status: 'success' | 'retry' | 'failed';
    error?: string;
  }>;
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
  
  // Ensure the ingestion_queue table exists with proper structure (idempotent)
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS public.ingestion_queue (
        id BIGSERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        source_id BIGINT,
        status TEXT NOT NULL DEFAULT 'pending',
        tries INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        lang TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ingestion_queue_url_idx ON public.ingestion_queue(url);
    `;
    
    const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: createTableSql }),
    });
    
    // Continue even if table creation fails (table might already exist)
    if (!createResponse.ok) {
      console.log('Table creation skipped (may already exist)');
    }
  } catch (error) {
    console.log('Table creation error (continuing):', error.message);
  }
  
  // 1. Pick up to N rows with FOR UPDATE SKIP LOCKED using raw SQL
  const selectSql = `
    SELECT id, url, source_id, status, tries, error, created_at, updated_at
    FROM public.ingestion_queue 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;
  
  let queueItems: QueueItem[] = [];
  
  try {
    const rawSqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: selectSql }),
    });

    if (rawSqlResponse.ok) {
      const sqlResult = await rawSqlResponse.json();
      queueItems = sqlResult.data || [];
    } else {
      throw new Error('Raw SQL query failed');
    }
  } catch (error) {
    console.log('FOR UPDATE SKIP LOCKED failed, falling back to regular SELECT');
    
    // Fallback to regular REST API query
    const fetchResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/ingestion_queue?status=eq.pending&order=created_at.asc&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      throw new Error(`Failed to fetch queue items: ${errorText}`);
    }

    queueItems = await fetchResponse.json();
  }

  console.log(`Found ${queueItems.length} pending items to process`);

  if (queueItems.length === 0) {
    return { processed: 0, done: 0, errors: 0, details: [] };
  }

  const result: ProcessResult = { processed: 0, done: 0, errors: 0, details: [] };

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
        
        result.details.push({
          id: item.id,
          url: item.url,
          status: 'success'
        });
        
        return { success: true, id: item.id };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process item ${item.id}:`, errorMessage);
        
        // Check if error is due to duplicate/unique constraint violation
        const isDuplicateError = errorMessage.includes('duplicate') || 
                                errorMessage.includes('uq_drops_url_hash') || 
                                errorMessage.includes('unique constraint');
        
        if (isDuplicateError) {
          // Treat duplicate as success - URL already exists
          await updateQueueItem(item.id, {
            status: 'done',
            error: null,
          });
          console.log(`Item ${item.id} treated as success (duplicate URL already exists)`);
          
          result.details.push({
            id: item.id,
            url: item.url,
            status: 'success'
          });
          
          return { success: true, id: item.id };
        }
        
        // 5. On other failures, handle retry logic
        const newTries = item.tries + 1;
        
        if (newTries < 5) {
          // Set back to pending for retry
          await updateQueueItem(item.id, {
            status: 'pending',
            error: errorMessage,
          });
          console.log(`Item ${item.id} will be retried (attempt ${newTries}/5)`);
          
          result.details.push({
            id: item.id,
            url: item.url,
            status: 'retry',
            error: errorMessage
          });
        } else {
          // Max tries reached, set to error
          await updateQueueItem(item.id, {
            status: 'error',
            error: errorMessage,
          });
          console.log(`Item ${item.id} failed permanently after ${newTries} attempts`);
          
          result.details.push({
            id: item.id,
            url: item.url,
            status: 'failed',
            error: errorMessage
          });
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
          result.errors++;
        }
      } else {
        result.errors++;
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
      processed: 0,
      done: 0,
      errors: 1,
      details: [],
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
CURL EXAMPLES:

# Process queue with default limit (20)
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/ingest-queue \
  -H "Content-Type: application/json"

# Process queue with custom limit
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/ingest-queue \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Manual trigger via GET
curl -X GET https://qimelntuxquptqqynxzv.supabase.co/functions/v1/ingest-queue

# GET with limit parameter  
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/ingest-queue?limit=5"
*/