import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ProcessingStats {
  feeds_processed: number;
  new_articles: number;
  ingestion_processed: number;
  articles_tagged: number;
  embeddings_processed?: number;
  errors: string[];
}

async function callEdgeFunction(functionName: string, body: any = {}, queryParams: string = ''): Promise<any> {
  try {
    console.log(`Calling ${functionName} function${queryParams ? ` with params: ${queryParams}` : ''}...`);
    
    // For fetch-rss with query parameters, we need to use a direct HTTP call
    if (functionName === 'fetch-rss' && queryParams) {
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-rss${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`${functionName} completed successfully:`, data);
      return data;
    }
    
    // Regular Supabase function invocation for other functions
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw error;
    }

    console.log(`${functionName} completed successfully:`, data);
    return data;
  } catch (error) {
    console.error(`Failed to call ${functionName}:`, error);
    throw error;
  }
}

async function waitWithTimeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAutomatedIngestion(): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    feeds_processed: 0,
    new_articles: 0,
    ingestion_processed: 0,
    articles_tagged: 0,
    errors: []
  };

  try {
    console.log('🚀 Starting automated content ingestion cycle...');

    // Step 1: Fetch RSS feeds in multiple batches to prevent timeouts
    console.log('📡 Step 1: Fetching RSS feeds in paginated batches...');
    
    let totalFeedsProcessed = 0;
    let totalNewArticles = 0;
    let offset = 0;
    const limit = 40; // Process 40 sources per batch to avoid timeouts
    let hasMore = true;
    let batchNumber = 1;

    try {
      while (hasMore) {
        console.log(`📡 Processing RSS batch ${batchNumber} (offset: ${offset}, limit: ${limit})...`);
        
        try {
          const rssResult = await callEdgeFunction('fetch-rss', {}, `?offset=${offset}&limit=${limit}`);
          
          const feedsProcessed = rssResult?.sources || 0;
          const newArticles = rssResult?.enqueued || 0;
          
          totalFeedsProcessed += feedsProcessed;
          totalNewArticles += newArticles;
          hasMore = rssResult?.has_more || false;
          
          console.log(`✅ RSS batch ${batchNumber} completed: ${feedsProcessed} feeds, ${newArticles} new articles`);
          
          if (hasMore) {
            offset += limit;
            batchNumber++;
            // Small delay between batches to prevent overwhelming the system
            await waitWithTimeout(2000);
          }
          
        } catch (batchError) {
          console.error(`❌ RSS batch ${batchNumber} failed:`, batchError);
          stats.errors.push(`RSS batch ${batchNumber} failed: ${batchError.message}`);
          // Continue with next batch even if one fails
          offset += limit;
          batchNumber++;
          hasMore = batchNumber <= 10; // Safety limit: max 10 batches (400 sources)
        }
      }
      
      stats.feeds_processed = totalFeedsProcessed;
      stats.new_articles = totalNewArticles;
      
      console.log(`✅ All RSS batches completed: ${totalFeedsProcessed} total feeds, ${totalNewArticles} total new articles`);
    } catch (error) {
      stats.errors.push(`RSS fetch failed: ${error.message}`);
      console.error('❌ RSS fetch failed:', error);
    }

    // Reduced wait time for faster processing
    await waitWithTimeout(1000);

    // Step 2: Process ingestion queue (INCREASED SPEED)
    console.log('🔄 Step 2: Processing ingestion queue...');
    try {
      const ingestionResult = await callEdgeFunction('ingest-queue', {
        trigger: 'automated',
        batch_size: 150, // INCREASED: 150 articles per hour (was 60)
        timeout_minutes: 15, // More time for larger batches
        concurrent_processes: 3 // Process multiple articles in parallel
      });
      
      stats.ingestion_processed = ingestionResult?.processed || 0;
      console.log(`✅ Ingestion completed: ${stats.ingestion_processed} articles processed`);
    } catch (error) {
      stats.errors.push(`Ingestion failed: ${error.message}`);
      console.error('❌ Ingestion failed:', error);
    }

    // Reduced wait time
    await waitWithTimeout(1000);

    // Step 3: Tag articles (INCREASED SPEED)
    console.log('🏷️ Step 3: Tagging articles...');
    try {
      const taggingResult = await callEdgeFunction('tag-drops', {
        trigger: 'automated',
        batch_size: 80, // INCREASED: More articles per batch (was 30)
        max_articles: 200, // INCREASED: Process more articles (was 100)
        concurrent_requests: 5 // Process multiple articles in parallel
      });
      
      stats.articles_tagged = taggingResult?.tagged || 0;
      console.log(`✅ Tagging completed: ${stats.articles_tagged} articles tagged`);
    } catch (error) {
      stats.errors.push(`Tagging failed: ${error.message}`);
      console.error('❌ Tagging failed:', error);
    }

    // Reduced wait time
    await waitWithTimeout(1000);

    // Step 4: Generate embeddings for new content
    console.log('🧠 Step 4: Generating embeddings for recent content...');
    let embeddingsProcessed = 0;
    try {
      const embeddingsResult = await callEdgeFunction('automated-embeddings', {
        action: 'embeddings',
        since_minutes: 120 // Last 2 hours to catch all new content
      });
      
      embeddingsProcessed = embeddingsResult?.result?.processed || 0;
      console.log(`✅ Embeddings completed: ${embeddingsProcessed} drops processed`);
    } catch (error) {
      stats.errors.push(`Embeddings failed: ${error.message}`);
      console.error('❌ Embeddings failed:', error);
    }
    
    // Add embeddings to stats
    stats.embeddings_processed = embeddingsProcessed;

    console.log('🎉 Automated ingestion cycle completed!', stats);
    
    // Log stats to database for monitoring
    await logIngestionStats(stats);
    
    // Schedule next execution in 1 hour (self-triggering system)
    scheduleNextExecution();
    
    return stats;

  } catch (error) {
    console.error('💥 Fatal error in automated ingestion:', error);
    stats.errors.push(`Fatal error: ${error.message}`);
    await logIngestionStats(stats);
    throw error;
  }
}

async function scheduleNextExecution() {
  try {
    console.log('🕐 Scheduling next automated ingestion in 1 hour...');
    
    // Use setTimeout directly (Edge Runtime supports this)
    setTimeout(async () => {
      try {
        console.log('⏰ Auto-trigger: Starting scheduled ingestion cycle...');
        
        // Call the function again via HTTP request to avoid recursion issues
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/automated-ingestion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ trigger: 'auto_scheduled' })
        });
        
        if (response.ok) {
          console.log('✅ Auto-trigger: Scheduled ingestion completed');
        } else {
          console.error('❌ Auto-trigger: Scheduled ingestion failed:', await response.text());
        }
      } catch (error) {
        console.error('❌ Auto-trigger: Scheduled ingestion failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour in milliseconds
    
    console.log('✅ Next execution scheduled successfully');
  } catch (error) {
    console.error('❌ Failed to schedule next execution:', error);
  }
}

async function logIngestionStats(stats: ProcessingStats) {
  try {
    const { error } = await supabase
      .from('ingestion_logs')
      .insert({
        cycle_timestamp: new Date().toISOString(),
        feeds_processed: stats.feeds_processed,
        new_articles: stats.new_articles,
        ingestion_processed: stats.ingestion_processed,
        articles_tagged: stats.articles_tagged,
        errors: stats.errors,
        success: stats.errors.length === 0
      });

    if (error) {
      console.error('Failed to log ingestion stats:', error);
    }
  } catch (error) {
    console.error('Error logging stats:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trigger } = await req.json().catch(() => ({ trigger: 'manual' }));
    
    console.log(`🔥 Automated ingestion triggered: ${trigger}`);
    
    // Check if cron job is enabled
    const { data: cronJob } = await supabase
      .from('cron_jobs')
      .select('enabled')
      .eq('name', 'auto-ingest-worker')
      .single();
    
    if (cronJob && !cronJob.enabled) {
      console.log('⏸️ Automated ingestion is disabled');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Automated ingestion is disabled',
          trigger 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Run the automated ingestion process
    const stats = await runAutomatedIngestion();

    // For the first manual trigger or restart, start the self-scheduling
    if (trigger === 'manual' || trigger === 'restart') {
      console.log('🚀 Starting self-scheduling system...');
      scheduleNextExecution();
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automated ingestion completed successfully',
        stats,
        trigger,
        timestamp: new Date().toISOString(),
        next_scheduled: trigger === 'manual' || trigger === 'restart' ? 'in 1 hour' : 'continuing schedule'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('🚨 Automated ingestion error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});