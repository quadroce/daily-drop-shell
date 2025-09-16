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

    // Load recent user feedback (last 90 days) with embeddings
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: feedbackData, error: feedbackError } = await supabase
      .from('engagement_events')
      .select(`
        action,
        created_at,
        drops!inner(embedding)
      `)
      .eq('user_id', userId)
      .in('action', ['like', 'save', 'open', 'dismiss', 'dislike'])
      .gte('created_at', ninetyDaysAgo.toISOString())
      .not('drops.embedding', 'is', null);

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user feedback' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!feedbackData || feedbackData.length === 0) {
      console.log('No feedback with embeddings found for user');
      return new Response(null, { status: 204, headers: corsHeaders });
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
      console.log('No significant weighted vectors found');
      return new Response(null, { status: 204, headers: corsHeaders });
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