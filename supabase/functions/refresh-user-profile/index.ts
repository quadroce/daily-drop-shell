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

    console.log(`Refreshing profile vector for user: ${userId}`);

    // Load recent user feedback (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    console.log(`Fetching engagement events for user ${userId} since ${ninetyDaysAgo.toISOString()}`);

    // First, get engagement events
    const { data: engagementEvents, error: engagementError } = await supabase
      .from('engagement_events')
      .select('action, created_at, drop_id')
      .eq('user_id', userId)
      .in('action', ['like', 'save', 'open', 'dismiss', 'dislike'])
      .gte('created_at', ninetyDaysAgo.toISOString());

    if (engagementError) {
      console.error('Error fetching engagement events:', engagementError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user engagement events' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!engagementEvents || engagementEvents.length === 0) {
      console.log('No engagement events found for user');
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

    console.log(`Found ${engagementEvents.length} engagement events`);

    // Get unique drop IDs
    const dropIds = [...new Set(engagementEvents.map(e => e.drop_id))];
    console.log(`Fetching embeddings for ${dropIds.length} unique drops`);

    // Then, get embeddings for those drops
    const { data: dropsWithEmbeddings, error: dropsError } = await supabase
      .from('drops')
      .select('id, embedding')
      .in('id', dropIds)
      .not('embedding', 'is', null);

    if (dropsError) {
      console.error('Error fetching drop embeddings:', dropsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content embeddings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${dropsWithEmbeddings?.length || 0} drops with embeddings`);

    // Create a map of drop_id to embedding for quick lookup
    const embeddingMap = new Map();
    if (dropsWithEmbeddings) {
      dropsWithEmbeddings.forEach(drop => {
        embeddingMap.set(drop.id, drop.embedding);
      });
    }

    // Combine engagement events with their embeddings
    const feedbackData = engagementEvents
      .map(event => {
        const embedding = embeddingMap.get(event.drop_id);
        if (!embedding) return null;
        return {
          action: event.action,
          created_at: event.created_at,
          drops: { embedding }
        };
      })
      .filter(item => item !== null);

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user feedback' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!feedbackData || feedbackData.length === 0) {
      console.log('No feedback with embeddings found for user');
      
      // Verifica se ci sono feedback senza embeddings
      const { data: allFeedback } = await supabase
        .from('engagement_events')
        .select('action')
        .eq('user_id', userId)
        .gte('created_at', ninetyDaysAgo.toISOString());
      
      const message = allFeedback && allFeedback.length > 0 
        ? `Found ${allFeedback.length} feedback items but none have embeddings. Try running 'Process Recent Embeddings' first.`
        : 'No user feedback found. Start interacting with content to build your profile.';
      
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

    console.log(`Processing ${feedbackData.length} feedback items`);

    // Process feedback with weights and time decay
    const actionWeights: { [key: string]: number } = {
      'like': 3,
      'save': 2,
      'open': 1,
      'dismiss': -2,
      'dislike': -3
    };

    const now = new Date();
    const weightedVectors: number[][] = [];
    const weights: number[] = [];

    feedbackData.forEach((item: any) => {
      const embedding = item.drops.embedding;
      if (!embedding || !Array.isArray(embedding)) return;

      const actionWeight = actionWeights[item.action] || 0;
      const createdAt = new Date(item.created_at);
      const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Time decay: weight *= exp(-age_days / 21)
      const timeDecay = Math.exp(-ageDays / 21);
      const finalWeight = actionWeight * timeDecay;

      if (Math.abs(finalWeight) > 0.01) { // Only include if weight is significant
        weightedVectors.push(embedding.map(val => val * finalWeight));
        weights.push(Math.abs(finalWeight));
      }
    });

    if (weightedVectors.length === 0) {
      console.log(`No significant weighted vectors found (processed ${feedbackData.length} feedback items)`);
      console.log('Action summary:', feedbackData.reduce((acc: any, item: any) => {
        acc[item.action] = (acc[item.action] || 0) + 1;
        return acc;
      }, {}));
      
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
    const embeddingDim = weightedVectors[0].length;
    const avgVector = new Array(embeddingDim).fill(0);
    let totalWeight = 0;

    weightedVectors.forEach((vector, idx) => {
      const weight = weights[idx];
      totalWeight += weight;
      for (let i = 0; i < embeddingDim; i++) {
        avgVector[i] += vector[i];
      }
    });

    // Normalize by total weight
    for (let i = 0; i < embeddingDim; i++) {
      avgVector[i] /= totalWeight;
    }

    // L2 normalize the final vector
    const magnitude = Math.sqrt(avgVector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embeddingDim; i++) {
        avgVector[i] /= magnitude;
      }
    }

    // UPSERT into user_profile_vectors
    const { error: upsertError } = await supabase
      .from('user_profile_vectors')
      .upsert({
        user_id: userId,
        profile_vec: avgVector,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Error upserting profile vector:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile vector' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated profile vector for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed_items: feedbackData.length,
        weighted_vectors: weightedVectors.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});