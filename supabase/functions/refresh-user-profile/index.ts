import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRow {
  action: string;
  created_at: string;
  embedding: number[] | null;
}

// Helper function to parse embeddings from various formats (vector, string, array)
function parseEmbedding(embedding: any): number[] | null {
  if (!embedding) return null;
  
  // Already an array
  if (Array.isArray(embedding)) {
    return embedding;
  }
  
  // String representation (parse it)
  if (typeof embedding === 'string') {
    try {
      // Handle vector format like "[1,2,3]" or PostgreSQL array format
      const cleaned = embedding.replace(/[\[\]]/g, '').split(',').map(x => parseFloat(x.trim()));
      return cleaned.every(x => !isNaN(x)) ? cleaned : null;
    } catch (e) {
      console.log(`    ↳ Failed to parse string embedding: ${e}`);
      return null;
    }
  }
  
  // Handle object with numeric properties (sometimes vector types return as objects)
  if (typeof embedding === 'object' && embedding !== null) {
    const keys = Object.keys(embedding);
    if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k)))) {
      const arr = keys.sort((a, b) => parseInt(a) - parseInt(b)).map(k => embedding[k]);
      return arr.every(x => typeof x === 'number' && !isNaN(x)) ? arr : null;
    }
  }
  
  console.log(`    ↳ Unknown embedding format: ${typeof embedding}`);
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id } = await req.json();
    const userId = user_id || user.user.id;

    console.log('=== STARTING PROFILE REFRESH ===');
    console.log(`📊 Step 1: Starting profile refresh for user: ${userId}`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

    // Load recent user feedback (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    console.log(`📅 Step 2: Date range calculation complete`);
    console.log(`  ↳ From: ${ninetyDaysAgo.toISOString()}`);
    console.log(`  ↳ To: ${new Date().toISOString()}`);
    console.log(`  ↳ Days back: 90`);

    console.log(`🔍 Step 3: Fetching engagement events for user ${userId}`);
    console.log(`  ↳ Table: engagement_events`);
    console.log(`  ↳ Filter: user_id = ${userId}`);
    console.log(`  ↳ Actions: ['like', 'save', 'open', 'dismiss', 'dislike']`);
    console.log(`  ↳ Since: ${ninetyDaysAgo.toISOString()}`);

    // First, get engagement events
    const { data: engagementEvents, error: engagementError } = await supabase
      .from('engagement_events')
      .select('action, created_at, drop_id')
      .eq('user_id', userId)
      .in('action', ['like', 'save', 'open', 'dismiss', 'dislike'])
      .gte('created_at', ninetyDaysAgo.toISOString());

    console.log(`✅ Step 4: Engagement events query completed`);
    
    if (engagementError) {
      console.error('❌ CRITICAL ERROR: Failed to fetch engagement events');
      console.error(`  ↳ Error details:`, engagementError);
      console.error(`  ↳ Error message: ${engagementError.message}`);
      console.error(`  ↳ Error code: ${engagementError.code}`);
      console.error(`  ↳ Error hint: ${engagementError.hint}`);
      console.error(`  ↳ User ID: ${userId}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user engagement events' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Step 5: Processing engagement events results`);
    console.log(`  ↳ Raw data: ${JSON.stringify(engagementEvents, null, 2)}`);
    console.log(`  ↳ Is null: ${engagementEvents === null}`);
    console.log(`  ↳ Is undefined: ${engagementEvents === undefined}`);
    console.log(`  ↳ Is array: ${Array.isArray(engagementEvents)}`);
    console.log(`  ↳ Length: ${engagementEvents?.length || 0}`);

    if (!engagementEvents || engagementEvents.length === 0) {
      console.log('⚠️ EARLY EXIT: No engagement events found for user');
      console.log(`  ↳ Returning 422 status with user guidance`);
      return new Response(
        JSON.stringify({ 
          error: 'No user engagement found',
          details: 'Start interacting with content (like, save, open articles) to build your profile'
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🎉 Step 6: Found ${engagementEvents.length} engagement events`);
    console.log(`  ↳ Actions breakdown:`);
    const actionCounts = engagementEvents.reduce((acc: Record<string, number>, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(actionCounts).forEach(([action, count]) => {
      console.log(`    ↳ ${action}: ${count}`);
    });

    // Get unique drop IDs
    const dropIds = [...new Set(engagementEvents.map(e => e.drop_id))];
    console.log(`🔍 Step 7: Extracting unique drop IDs`);
    console.log(`  ↳ Total events: ${engagementEvents.length}`);
    console.log(`  ↳ Unique drops: ${dropIds.length}`);
    console.log(`  ↳ Drop IDs: [${dropIds.slice(0, 10).join(', ')}${dropIds.length > 10 ? '...' : ''}]`);

    console.log(`🎯 Step 8: Fetching embeddings for drops`);
    console.log(`  ↳ Table: drops`);
    console.log(`  ↳ Query: SELECT id, embedding WHERE id IN [${dropIds.length} items] AND embedding IS NOT NULL`);

    // Then, get embeddings for those drops
    const { data: dropsWithEmbeddings, error: dropsError } = await supabase
      .from('drops')
      .select('id, embedding')
      .in('id', dropIds)
      .not('embedding', 'is', null);

    console.log(`✅ Step 9: Embeddings query completed`);
    
    if (dropsError) {
      console.error('❌ CRITICAL ERROR: Failed to fetch drop embeddings');
      console.error(`  ↳ Error details:`, dropsError);
      console.error(`  ↳ Error message: ${dropsError.message}`);
      console.error(`  ↳ Error code: ${dropsError.code}`);
      console.error(`  ↳ Error hint: ${dropsError.hint}`);
      console.error(`  ↳ Drop IDs attempted: [${dropIds.slice(0, 5).join(', ')}${dropIds.length > 5 ? '...' : ''}]`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content embeddings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Step 10: Processing embeddings results`);
    console.log(`  ↳ Raw data length: ${dropsWithEmbeddings?.length || 0}`);
    console.log(`  ↳ Is null: ${dropsWithEmbeddings === null}`);
    console.log(`  ↳ Is undefined: ${dropsWithEmbeddings === undefined}`);
    console.log(`  ↳ Is array: ${Array.isArray(dropsWithEmbeddings)}`);
    console.log(`  ↳ Expected ${dropIds.length} drops, got ${dropsWithEmbeddings?.length || 0} with embeddings`);
    
    if (dropsWithEmbeddings && dropsWithEmbeddings.length > 0) {
      console.log(`  ↳ Sample embedding info:`);
      console.log(`    ↳ First drop ID: ${dropsWithEmbeddings[0].id}`);
      console.log(`    ↳ First embedding type: ${typeof dropsWithEmbeddings[0].embedding}`);
      console.log(`    ↳ First embedding length: ${Array.isArray(dropsWithEmbeddings[0].embedding) ? dropsWithEmbeddings[0].embedding.length : 'N/A'}`);
    }

    // Create a map of drop_id to embedding for quick lookup
    console.log(`🗺️ Step 11: Creating embedding lookup map`);
    const embeddingMap = new Map();
    if (dropsWithEmbeddings) {
      dropsWithEmbeddings.forEach((drop, index) => {
        console.log(`  ↳ Mapping drop ${drop.id} (${index + 1}/${dropsWithEmbeddings.length})`);
        embeddingMap.set(drop.id, drop.embedding);
      });
    }
    console.log(`  ↳ Created map with ${embeddingMap.size} entries`);

    // Combine engagement events with their embeddings
    console.log(`🔗 Step 12: Combining engagement events with embeddings`);
    console.log(`  ↳ Processing ${engagementEvents.length} engagement events`);
    
    const feedbackData: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    engagementEvents.forEach((event, index) => {
      const embedding = embeddingMap.get(event.drop_id);
      console.log(`  ↳ Event ${index + 1}/${engagementEvents.length}: drop_id=${event.drop_id}, action=${event.action}, has_embedding=${!!embedding}`);
      
      if (!embedding) {
        unmatchedCount++;
        return;
      }
      
      matchedCount++;
      feedbackData.push({
        action: event.action,
        created_at: event.created_at,
        drops: { embedding }
      });
    });

    console.log(`📈 Step 13: Combination results`);
    console.log(`  ↳ Total events: ${engagementEvents.length}`);
    console.log(`  ↳ Matched with embeddings: ${matchedCount}`);
    console.log(`  ↳ Unmatched (no embeddings): ${unmatchedCount}`);
    console.log(`  ↳ Final feedback data length: ${feedbackData.length}`);

    console.log(`⚠️ Step 14: Checking for usable feedback data`);
    
    if (!feedbackData || feedbackData.length === 0) {
      console.log('❌ EARLY EXIT: No feedback with embeddings found for user');
      console.log(`  ↳ Feedback data is null: ${feedbackData === null}`);
      console.log(`  ↳ Feedback data is undefined: ${feedbackData === undefined}`);
      console.log(`  ↳ Feedback data length: ${feedbackData?.length || 0}`);
      
      console.log(`🔍 Step 14.1: Investigating missing embeddings`);
      // Verifica se ci sono feedback senza embeddings
      const { data: allFeedback } = await supabase
        .from('engagement_events')
        .select('action')
        .eq('user_id', userId)
        .gte('created_at', ninetyDaysAgo.toISOString());
      
      console.log(`  ↳ Total feedback without embedding filter: ${allFeedback?.length || 0}`);
      
      const message = allFeedback && allFeedback.length > 0 
        ? `Found ${allFeedback.length} feedback items but none have embeddings. Try running 'Process Recent Embeddings' first.`
        : 'No user feedback found. Start interacting with content to build your profile.';
      
      console.log(`  ↳ Exit message: ${message}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'No feedback with embeddings found',
          details: message,
          total_feedback: allFeedback?.length || 0
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🎯 Step 15: Processing feedback for vector calculation`);
    console.log(`  ↳ Total feedback items to process: ${feedbackData.length}`);

    // Process feedback with weights and time decay
    console.log(`⚖️ Step 16: Setting up action weights and time decay`);
    const actionWeights: { [key: string]: number } = {
      'like': 3,
      'save': 2,
      'open': 2, // Doubled from 1 to 2
      'dismiss': -2,
      'dislike': -3
    };
    console.log(`  ↳ Action weights:`, actionWeights);

    const now = new Date();
    console.log(`  ↳ Current time: ${now.toISOString()}`);
    
    const weightedVectors: number[][] = [];
    const weights: number[] = [];

    console.log(`🧮 Step 17: Computing weighted vectors`);
    
    feedbackData.forEach((item: any, index: number) => {
      const rawEmbedding = item.drops.embedding;
      console.log(`  ↳ Processing item ${index + 1}/${feedbackData.length}:`);
      console.log(`    ↳ Action: ${item.action}`);
      console.log(`    ↳ Created at: ${item.created_at}`);
      console.log(`    ↳ Has embedding: ${!!rawEmbedding}`);
      console.log(`    ↳ Raw embedding type: ${typeof rawEmbedding}`);
      console.log(`    ↳ Raw embedding is array: ${Array.isArray(rawEmbedding)}`);
      
      // Parse embedding from any format
      const embedding = parseEmbedding(rawEmbedding);
      console.log(`    ↳ Parsed embedding: ${!!embedding}`);
      console.log(`    ↳ Parsed embedding length: ${embedding?.length || 'N/A'}`);
      
      if (!embedding) {
        console.log(`    ↳ ❌ Skipping: could not parse embedding`);
        return;
      }

      const actionWeight = actionWeights[item.action] || 0;
      console.log(`    ↳ Base action weight: ${actionWeight}`);
      
      const createdAt = new Date(item.created_at);
      const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`    ↳ Age in days: ${ageDays.toFixed(2)}`);
      
      // Time decay: weight *= exp(-age_days / 21)
      const timeDecay = Math.exp(-ageDays / 21);
      console.log(`    ↳ Time decay factor: ${timeDecay.toFixed(4)}`);
      
      const finalWeight = actionWeight * timeDecay;
      console.log(`    ↳ Final weight: ${finalWeight.toFixed(4)}`);

      if (Math.abs(finalWeight) > 0.005) { // Reduced threshold from 0.01 to 0.005
        const weightedEmbedding = embedding.map(val => val * finalWeight);
        weightedVectors.push(weightedEmbedding);
        weights.push(Math.abs(finalWeight));
        console.log(`    ↳ ✅ Added to weighted vectors (total: ${weightedVectors.length})`);
      } else {
        console.log(`    ↳ ❌ Skipped: weight too small (${Math.abs(finalWeight).toFixed(4)} < 0.005)`);
      }
    });

    console.log(`📊 Step 18: Weighted vectors summary`);
    console.log(`  ↳ Total feedback items: ${feedbackData.length}`);
    console.log(`  ↳ Significant weighted vectors: ${weightedVectors.length}`);
    console.log(`  ↳ Weights array length: ${weights.length}`);

    console.log(`⚠️ Step 19: Checking weighted vectors validity`);
    
    if (weightedVectors.length === 0) {
      console.log(`❌ EARLY EXIT: No significant weighted vectors found`);
      console.log(`  ↳ Processed feedback items: ${feedbackData.length}`);
      console.log(`  ↳ Weighted vectors created: ${weightedVectors.length}`);
      
      console.log(`📊 Action breakdown for debugging:`);
      const actionSummary = feedbackData.reduce((acc: any, item: any) => {
        acc[item.action] = (acc[item.action] || 0) + 1;
        return acc;
      }, {});
      Object.entries(actionSummary).forEach(([action, count]) => {
        console.log(`  ↳ ${action}: ${count}`);
      });
      
      // Restituire un errore più informativo invece di 204
      return new Response(
        JSON.stringify({ 
          error: 'No significant user feedback found to generate profile vector',
          feedback_items: feedbackData.length,
          details: 'Try interacting with more content (like, save, open articles) to build your profile'
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Compute weighted average vector
    console.log(`🧮 Step 20: Computing weighted average vector`);
    const embeddingDim = weightedVectors[0].length;
    console.log(`  ↳ Embedding dimension: ${embeddingDim}`);
    console.log(`  ↳ Number of weighted vectors: ${weightedVectors.length}`);
    
    const avgVector = new Array(embeddingDim).fill(0);
    let totalWeight = 0;

    console.log(`  ↳ Accumulating weighted vectors...`);
    weightedVectors.forEach((vector, idx) => {
      const weight = weights[idx];
      totalWeight += weight;
      console.log(`    ↳ Vector ${idx + 1}/${weightedVectors.length}: weight=${weight.toFixed(4)}`);
      for (let i = 0; i < embeddingDim; i++) {
        avgVector[i] += vector[i];
      }
    });

    console.log(`  ↳ Total accumulated weight: ${totalWeight.toFixed(4)}`);

    // Normalize by total weight
    console.log(`🔧 Step 21: Normalizing by total weight`);
    for (let i = 0; i < embeddingDim; i++) {
      avgVector[i] /= totalWeight;
    }
    console.log(`  ↳ Weight normalization complete`);

    // L2 normalize the final vector
    console.log(`📐 Step 22: L2 normalizing the final vector`);
    const magnitude = Math.sqrt(avgVector.reduce((sum, val) => sum + val * val, 0));
    console.log(`  ↳ Vector magnitude: ${magnitude.toFixed(6)}`);
    
    if (magnitude > 0) {
      for (let i = 0; i < embeddingDim; i++) {
        avgVector[i] /= magnitude;
      }
      console.log(`  ↳ L2 normalization complete`);
    } else {
      console.log(`  ↳ ⚠️ WARNING: Zero magnitude vector, skipping L2 normalization`);
    }

    // Final vector statistics
    console.log(`📊 Step 23: Final vector statistics`);
    console.log(`  ↳ Vector length: ${avgVector.length}`);
    console.log(`  ↳ First 5 components: [${avgVector.slice(0, 5).map(v => v.toFixed(6)).join(', ')}...]`);
    console.log(`  ↳ Vector sum: ${avgVector.reduce((sum, val) => sum + val, 0).toFixed(6)}`);
    console.log(`  ↳ Vector magnitude after L2 norm: ${Math.sqrt(avgVector.reduce((sum, val) => sum + val * val, 0)).toFixed(6)}`);

    // UPSERT into user_profile_vectors
    console.log(`💾 Step 24: Upserting profile vector to database`);
    console.log(`  ↳ Table: user_profile_vectors`);
    console.log(`  ↳ User ID: ${userId}`);
    console.log(`  ↳ Vector dimension: ${avgVector.length}`);
    console.log(`  ↳ Timestamp: ${new Date().toISOString()}`);
    
    const { error: upsertError } = await supabase
      .from('user_profile_vectors')
      .upsert({
        user_id: userId,
        profile_vec: avgVector,
        updated_at: new Date().toISOString()
      });

    console.log(`✅ Step 25: Database upsert completed`);
    
    if (upsertError) {
      console.error('❌ CRITICAL ERROR: Failed to upsert profile vector');
      console.error(`  ↳ Error details:`, upsertError);
      console.error(`  ↳ Error message: ${upsertError.message}`);
      console.error(`  ↳ Error code: ${upsertError.code}`);
      console.error(`  ↳ Error hint: ${upsertError.hint}`);
      console.error(`  ↳ User ID: ${userId}`);
      console.error(`  ↳ Vector length: ${avgVector.length}`);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile vector' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎉 SUCCESS: Profile vector updated successfully`);
    console.log(`  ↳ User ID: ${userId}`);
    console.log(`  ↳ Processed feedback items: ${feedbackData.length}`);
    console.log(`  ↳ Significant weighted vectors: ${weightedVectors.length}`);
    console.log(`  ↳ Final vector dimension: ${avgVector.length}`);
    console.log(`  ↳ Update timestamp: ${new Date().toISOString()}`);
    console.log('=== PROFILE REFRESH COMPLETED SUCCESSFULLY ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed_items: feedbackData.length,
        weighted_vectors: weightedVectors.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 UNEXPECTED ERROR: Caught in main try-catch');
    console.error(`  ↳ Error type: ${typeof error}`);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error(`  ↳ Error name: ${errorObj.name}`);
    console.error(`  ↳ Error message: ${errorObj.message}`);
    console.error(`  ↳ Error stack:`, errorObj.stack || 'No stack trace');
    console.error(`  ↳ Full error object:`, error);
    console.error('=== PROFILE REFRESH FAILED WITH UNEXPECTED ERROR ===');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});