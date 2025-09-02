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
  errors: string[];
}

async function callEdgeFunction(functionName: string, body: any = {}): Promise<any> {
  try {
    console.log(`Calling ${functionName} function...`);
    
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

    // Step 1: Fetch RSS feeds
    console.log('📡 Step 1: Fetching RSS feeds...');
    try {
      const rssResult = await callEdgeFunction('fetch-rss', { 
        trigger: 'automated',
        max_feeds: 50 // Limit to prevent timeout
      });
      
      stats.feeds_processed = rssResult?.feeds_processed || 0;
      stats.new_articles = rssResult?.new_items || 0;
      
      console.log(`✅ RSS fetch completed: ${stats.feeds_processed} feeds, ${stats.new_articles} new articles`);
    } catch (error) {
      stats.errors.push(`RSS fetch failed: ${error.message}`);
      console.error('❌ RSS fetch failed:', error);
    }

    // Wait between steps to prevent overwhelming the system
    await waitWithTimeout(2000);

    // Step 2: Process ingestion queue
    console.log('🔄 Step 2: Processing ingestion queue...');
    try {
      const ingestionResult = await callEdgeFunction('ingest-queue', {
        trigger: 'automated',
        batch_size: 60, // Target 60 articles per hour
        timeout_minutes: 10
      });
      
      stats.ingestion_processed = ingestionResult?.processed || 0;
      console.log(`✅ Ingestion completed: ${stats.ingestion_processed} articles processed`);
    } catch (error) {
      stats.errors.push(`Ingestion failed: ${error.message}`);
      console.error('❌ Ingestion failed:', error);
    }

    // Wait between steps
    await waitWithTimeout(2000);

    // Step 3: Tag articles
    console.log('🏷️ Step 3: Tagging articles...');
    try {
      const taggingResult = await callEdgeFunction('tag-drops', {
        trigger: 'automated',
        batch_size: 30, // Process in smaller batches for tagging
        max_articles: 100
      });
      
      stats.articles_tagged = taggingResult?.tagged || 0;
      console.log(`✅ Tagging completed: ${stats.articles_tagged} articles tagged`);
    } catch (error) {
      stats.errors.push(`Tagging failed: ${error.message}`);
      console.error('❌ Tagging failed:', error);
    }

    console.log('🎉 Automated ingestion cycle completed!', stats);
    
    // Log stats to database for monitoring
    await logIngestionStats(stats);
    
    return stats;

  } catch (error) {
    console.error('💥 Fatal error in automated ingestion:', error);
    stats.errors.push(`Fatal error: ${error.message}`);
    await logIngestionStats(stats);
    throw error;
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
      .eq('name', 'automated_content_ingestion')
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automated ingestion completed successfully',
        stats,
        trigger,
        timestamp: new Date().toISOString()
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