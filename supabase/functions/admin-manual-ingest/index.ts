import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManualIngestRequest {
  url: string;
  source_label?: string;
  notes?: string;
}

interface ManualIngestResponse {
  status: 'exists' | 'queued' | 'error' | 'in_queue' | 'processing' | 'failed';
  content_id?: number;
  queue_id?: number;
  queue_status?: string;
  error?: string;
  message?: string;
}

function generateUrlHash(url: string): string {
  // Simple hash function for URL deduplication
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

async function checkUserPermissions(authHeader: string): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  
  try {
    // Decode JWT to get user ID (simple approach - in production consider proper JWT validation)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub;

    if (!userId) return false;

    // Check user role in profiles table
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return false;

    const profiles = await response.json();
    const profile = profiles[0];
    
    return profile && ['editor', 'admin', 'superadmin'].includes(profile.role);
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

async function checkExistingContent(url: string): Promise<{ 
  exists: boolean; 
  contentId?: number;
  inQueue?: boolean;
  queueId?: number;
  queueStatus?: string;
}> {
  const urlHash = generateUrlHash(url);
  
  // Check drops table first (already processed content)
  const dropsResponse = await fetch(`${SUPABASE_URL}/rest/v1/drops?url_hash=eq.${urlHash}&select=id,url`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!dropsResponse.ok) {
    throw new Error(`Failed to check existing content: ${dropsResponse.statusText}`);
  }

  const drops = await dropsResponse.json();
  const existingDrop = drops.find((drop: any) => drop.url === url);
  
  if (existingDrop) {
    return {
      exists: true,
      contentId: existingDrop.id
    };
  }

  // Check ingestion_queue table for pending/processing URLs
  const queueResponse = await fetch(`${SUPABASE_URL}/rest/v1/ingestion_queue?url=eq.${encodeURIComponent(url)}&select=id,status`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!queueResponse.ok) {
    throw new Error(`Failed to check ingestion queue: ${queueResponse.statusText}`);
  }

  const queueItems = await queueResponse.json();
  const existingQueueItem = queueItems[0];
  
  if (existingQueueItem) {
    return {
      exists: false,
      inQueue: true,
      queueId: existingQueueItem.id,
      queueStatus: existingQueueItem.status
    };
  }
  
  return {
    exists: false,
    inQueue: false
  };
}

async function addToIngestionQueue(url: string, sourceLabel?: string, notes?: string): Promise<number> {
  const queueData = {
    url,
    status: 'pending',
    tries: 0,
    lang: 'it', // Default language
    source_id: null, // Will be determined during processing
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Add metadata for manual ingestion
    ...(sourceLabel && { source_label: sourceLabel }),
    ...(notes && { notes: notes })
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/ingestion_queue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(queueData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add to queue: ${errorText}`);
  }

  const result = await response.json();
  return result[0].id;
}

async function logAdminAction(userId: string, url: string, queueId?: number) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        action: 'manual_ingest',
        resource_type: 'url',
        resource_id: url,
        details: {
          queue_id: queueId,
          timestamp: new Date().toISOString()
        }
      }),
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't fail the main operation for logging errors
  }
}

function validateUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return 'URL is required';
  if (url.length > 2048) return 'URL too long (max 2048 characters)';
  if (url.startsWith('data:')) return 'Data URLs are not supported';
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 'Only HTTPS URLs are supported';
    return null;
  } catch {
    return 'Invalid URL format';
  }
}

serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication and permissions
    const authHeader = req.headers.get('Authorization');
    const hasPermission = await checkUserPermissions(authHeader || '');
    
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ status: 'error', error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const requestBody: ManualIngestRequest = await req.json();
    const { url, source_label, notes } = requestBody;

    // Validate URL
    const urlError = validateUrl(url);
    if (urlError) {
      return new Response(
        JSON.stringify({ status: 'error', error: urlError }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalize URL (remove UTM params, trailing slashes)
    let normalizedUrl: string;
    try {
      const parsed = new URL(url.trim());
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
        parsed.searchParams.delete(param);
      });
      if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      normalizedUrl = parsed.toString();
    } catch {
      normalizedUrl = url.trim();
    }

    console.log(`Processing manual ingest for: ${normalizedUrl}`);

    // Check for existing content
    const existingCheck = await checkExistingContent(normalizedUrl);
    
    if (existingCheck.exists) {
      console.log(`URL already exists with content ID: ${existingCheck.contentId}`);
      
      const response: ManualIngestResponse = {
        status: 'exists',
        content_id: existingCheck.contentId,
        message: 'Content already processed and available'
      };
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if URL is already in queue
    if (existingCheck.inQueue) {
      console.log(`URL already in queue with status: ${existingCheck.queueStatus}`);
      
      let response: ManualIngestResponse;
      
      switch (existingCheck.queueStatus) {
        case 'pending':
          response = {
            status: 'in_queue',
            queue_id: existingCheck.queueId,
            queue_status: 'pending',
            message: 'URL is already queued for processing'
          };
          break;
        
        case 'processing':
          response = {
            status: 'processing',
            queue_id: existingCheck.queueId,
            queue_status: 'processing',
            message: 'URL is currently being processed'
          };
          break;
        
        case 'done':
          response = {
            status: 'in_queue',
            queue_id: existingCheck.queueId,
            queue_status: 'done',
            message: 'URL was processed but may not have resulted in content. Check processing logs.'
          };
          break;
        
        case 'failed':
          // Allow re-ingestion for failed items
          console.log('Re-queueing failed URL');
          break;
        
        default:
          response = {
            status: 'in_queue',
            queue_id: existingCheck.queueId,
            queue_status: existingCheck.queueStatus,
            message: `URL is in queue with status: ${existingCheck.queueStatus}`
          };
      }
      
      // Return early unless it's a failed item that we want to retry
      if (existingCheck.queueStatus !== 'failed') {
        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Add to ingestion queue
    console.log('Adding URL to ingestion queue');
    let queueId: number;
    
    try {
      queueId = await addToIngestionQueue(normalizedUrl, source_label, notes);
    } catch (error) {
      // Handle duplicate key error specifically
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
        console.log('URL already exists in queue, checking current status...');
        
        // Re-check the queue status since there might be a race condition
        const recheckResult = await checkExistingContent(normalizedUrl);
        if (recheckResult.inQueue) {
          const response: ManualIngestResponse = {
            status: 'in_queue',
            queue_id: recheckResult.queueId,
            queue_status: recheckResult.queueStatus,
            message: 'URL was already in queue'
          };
          
          return new Response(
            JSON.stringify(response),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      throw error; // Re-throw if it's not a duplicate key error
    }
    
    // Extract user ID for audit log
    const token = authHeader?.substring(7);
    let userId = null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (e) {
        console.error('Failed to extract user ID:', e);
      }
    }

    // Log admin action
    if (userId) {
      await logAdminAction(userId, normalizedUrl, queueId);
    }

    console.log(`Successfully queued URL with queue ID: ${queueId}`);

    const response: ManualIngestResponse = {
      status: 'queued',
      queue_id: queueId,
      message: existingCheck.queueStatus === 'failed' ? 
        'URL re-queued after previous failure' : 
        'URL successfully added to processing queue'
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Manual ingest error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const response: ManualIngestResponse = {
      status: 'error',
      error: errorMessage
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/*
USAGE EXAMPLES:

# Manual ingest with just URL
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/admin-manual-ingest \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'

# Manual ingest with metadata
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/admin-manual-ingest \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "source_label": "Example News",
    "notes": "Manually added important article"
  }'
*/