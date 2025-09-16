import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const EMBEDDING_MODEL = Deno.env.get('EMBEDDING_MODEL') || 'text-embedding-3-small';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

interface Drop {
  id: number;
  title: string;
  summary?: string;
  tags: string[];
}

async function getDropsToEmbed(sinceMinutes: number): Promise<Drop[]> {
  const cutoffTime = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('drops')
    .select('id, title, summary, tags')
    .or(`embedding.is.null,created_at.gte.${cutoffTime}`)
    .limit(1000); // Get up to 1000 candidates
    
  if (error) {
    console.error('Error fetching drops:', error);
    throw error;
  }
  
  return data || [];
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.data.map((item: any) => item.embedding);
}

async function updateDropEmbeddings(dropIds: number[], embeddings: number[][]): Promise<void> {
  for (let i = 0; i < dropIds.length; i++) {
    const { error } = await supabase
      .from('drops')
      .update({ embedding: embeddings[i] })
      .eq('id', dropIds[i]);
      
    if (error) {
      console.error(`Error updating drop ${dropIds[i]}:`, error);
      throw error;
    }
  }
}

async function processBatch(drops: Drop[]): Promise<{ success: number; errors: number }> {
  const BATCH_SIZE = 100;
  let totalSuccess = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < drops.length; i += BATCH_SIZE) {
    const batch = drops.slice(i, i + BATCH_SIZE);
    
    try {
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, items ${i + 1}-${Math.min(i + BATCH_SIZE, drops.length)}`);
      
      // Build text for each drop
      const texts = batch.map(drop => {
        const title = drop.title || '';
        const summary = drop.summary || '';
        const tags = Array.isArray(drop.tags) ? drop.tags.join(',') : '';
        return `${title} ${summary} ${tags}`.trim();
      });
      
      // Generate embeddings
      const embeddings = await generateEmbeddings(texts);
      
      // Update drops with embeddings
      const dropIds = batch.map(drop => drop.id);
      await updateDropEmbeddings(dropIds, embeddings);
      
      totalSuccess += batch.length;
      console.log(`Successfully embedded ${batch.length} drops in this batch`);
      
      // Rate limiting: wait 100ms between batches
      if (i + BATCH_SIZE < drops.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      totalErrors += batch.length;
    }
  }
  
  return { success: totalSuccess, errors: totalErrors };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  // Verify service role key
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.includes(SUPABASE_SERVICE_ROLE_KEY!)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Service role key required' }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  try {
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const sinceMinutes = body.since_minutes || 1440; // Default 24 hours
    
    console.log(`Starting embedding process for drops updated in the last ${sinceMinutes} minutes`);
    
    // Get drops to embed
    const drops = await getDropsToEmbed(sinceMinutes);
    console.log(`Found ${drops.length} drops to process`);
    
    if (drops.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No drops to embed',
          processed: 0,
          success: 0,
          errors: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Process in batches
    const results = await processBatch(drops);
    
    const response = {
      message: 'Embedding process completed',
      processed: drops.length,
      success: results.success,
      errors: results.errors,
      since_minutes: sinceMinutes,
    };
    
    console.log('Final results:', response);
    
    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in embed-drops function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});