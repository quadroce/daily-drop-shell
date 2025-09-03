import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RankedDrop {
  id: number;
  title: string;
  source: string;
  url: string;
  image_url?: string;
  type: string;
  tags: string[];
  final_score: number;
  reason_for_ranking: string;
  summary?: string;
}

interface RankingParams {
  limit?: number;
  user_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Ranking] Starting content ranking process');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract parameters from request
    let params: RankingParams = { limit: 10 };
    
    if (req.method === 'POST') {
      const body = await req.json();
      params = { ...params, ...body };
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = url.searchParams.get('limit');
      const user_id = url.searchParams.get('user_id');
      if (limit) params.limit = parseInt(limit);
      if (user_id) params.user_id = user_id;
    }

    console.log('[Ranking] Parameters:', params);

    // Get user from auth header if not provided
    let userId = params.user_id;
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user }, error } = await supabaseClient.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        if (user) userId = user.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[Ranking] Ranking for user:', userId);

    // Get user preferences and profile
    const { data: preferences, error: prefsError } = await supabaseClient
      .from('preferences')
      .select('selected_topic_ids, selected_language_ids')
      .eq('user_id', userId)
      .single();

    if (prefsError || !preferences) {
      console.log('[Ranking] No preferences found, using default ranking');
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('preference_embeddings')
      .eq('id', userId)
      .single();

    // Get candidate drops (published in last 30 days, tagged)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: drops, error: dropsError } = await supabaseClient
      .from('drops')
      .select(`
        id, title, url, image_url, summary, type, tags, 
        source_id, published_at, created_at,
        authority_score, quality_score, popularity_score, embeddings
      `)
      .eq('tag_done', true)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200); // Get more candidates for better ranking

    if (dropsError) {
      console.error('[Ranking] Error fetching drops:', dropsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!drops || drops.length === 0) {
      return new Response(
        JSON.stringify({ ranked_drops: [], total_candidates: 0 }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[Ranking] Processing', drops.length, 'candidate drops');

    // Get source information
    const sourceIds = [...new Set(drops.map(d => d.source_id).filter(Boolean))];
    const { data: sources } = await supabaseClient
      .from('sources')
      .select('id, name, type')
      .in('id', sourceIds);

    const sourceMap = new Map(sources?.map(s => [s.id, s]) || []);

    // Calculate rankings for each drop
    const rankedDrops: RankedDrop[] = [];

    for (const drop of drops) {
      try {
        // 1. Base Score Calculation
        const publishedAt = new Date(drop.published_at || drop.created_at);
        const hoursOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
        
        // Recency: exponential decay (50% after 48h)
        const recencyScore = Math.exp(-hoursOld * Math.log(2) / 48);
        
        // Trust Score: average of authority and quality
        const trustScore = (
          (drop.authority_score || 0.5) + 
          (drop.quality_score || 0.5)
        ) / 2;
        
        // Popularity: log-normalized
        const popularityScore = Math.log(1 + (drop.popularity_score || 0)) / Math.log(1000);
        
        const baseScore = (
          0.3 * Math.max(0, Math.min(1, recencyScore)) +
          0.25 * Math.max(0, Math.min(1, trustScore)) +
          0.15 * Math.max(0, Math.min(1, popularityScore))
        );

        // 2. Personalization Score
        let personalScore = 0;
        const reasonFactors: string[] = [];

        // Topic matching
        let topicMatch = 0;
        if (preferences?.selected_topic_ids?.length > 0) {
          // Get topics for selected topic IDs
          const { data: userTopics } = await supabaseClient
            .from('topics')
            .select('slug')
            .in('id', preferences.selected_topic_ids);

          const userTopicSlugs = userTopics?.map(t => t.slug) || [];
          const matchingTags = drop.tags?.filter(tag => 
            userTopicSlugs.some(slug => slug.toLowerCase() === tag.toLowerCase())
          ) || [];

          topicMatch = matchingTags.length > 0 ? 1 : 0;
          if (topicMatch > 0) {
            reasonFactors.push(`Matches interests: ${matchingTags.slice(0, 2).join(', ')}`);
          }
        }

        // Vector similarity (if embeddings available)
        let vectorSim = 0;
        if (drop.embeddings && profile?.preference_embeddings) {
          // For now, use a placeholder - would implement actual cosine similarity
          vectorSim = 0.5; // Placeholder
        }

        // User feedback score
        let feedbackScore = 0;
        try {
          const { data: feedbackResult, error: feedbackError } = await supabaseClient
            .rpc('get_user_feedback_score', {
              _user_id: userId,
              _drop_id: drop.id,
              _source_id: drop.source_id || 0,
              _tags: drop.tags || []
            });

          if (feedbackError) {
            console.warn('[Ranking] Feedback error for drop', drop.id, ':', feedbackError);
            feedbackScore = 0;
          } else {
            feedbackScore = feedbackResult || 0;
          }
        } catch (feedbackErr) {
          console.warn('[Ranking] Feedback exception for drop', drop.id, ':', feedbackErr);
          feedbackScore = 0;
        }

        if (feedbackScore > 0.1) {
          reasonFactors.push('Similar content liked before');
        }

        personalScore = (
          0.2 * topicMatch +
          0.25 * vectorSim +
          0.25 * feedbackScore
        );

        // 3. Final Score
        const finalScore = 0.4 * baseScore + 0.6 * personalScore;

        // Add recency factor to reasons
        if (hoursOld < 24) {
          reasonFactors.unshift('Fresh content');
        }
        if (trustScore > 0.7) {
          reasonFactors.push('High quality source');
        }

        const source = sourceMap.get(drop.source_id);
        rankedDrops.push({
          id: drop.id,
          title: drop.title,
          source: source?.name || 'Unknown Source',
          url: drop.url,
          image_url: drop.image_url,
          type: drop.type,
          tags: drop.tags || [],
          final_score: finalScore,
          reason_for_ranking: reasonFactors.slice(0, 2).join(' • ') || 'Relevant content',
          summary: drop.summary
        });

      } catch (error) {
        console.error('[Ranking] Error processing drop', drop.id, ':', error);
      }
    }

    // Sort by final score
    rankedDrops.sort((a, b) => b.final_score - a.final_score);

    // 4. Apply Constraints and Diversity
    const finalDrops: RankedDrop[] = [];
    const sourceCount = new Map<string, number>();
    const usedSources = new Set<string>();
    let youtubeCount = 0;
    let sponsorCount = 0;

    // First pass: ensure at least 1 YouTube item
    const youtubeDrops = rankedDrops.filter(d => d.type === 'video');
    if (youtubeDrops.length > 0) {
      finalDrops.push(youtubeDrops[0]);
      youtubeCount++;
      sourceCount.set(youtubeDrops[0].source, 1);
      usedSources.add(youtubeDrops[0].source);
    }

    // Second pass: apply constraints
    for (const drop of rankedDrops) {
      if (finalDrops.length >= (params.limit || 5)) break;
      
      // Skip if already added
      if (finalDrops.some(d => d.id === drop.id)) continue;
      
      // Max 2 items per source
      const currentSourceCount = sourceCount.get(drop.source) || 0;
      if (currentSourceCount >= 2) continue;
      
      // Max 1 sponsor item (if we had sponsored content)
      if (drop.type === 'sponsored' && sponsorCount >= 1) continue;
      
      finalDrops.push(drop);
      sourceCount.set(drop.source, currentSourceCount + 1);
      usedSources.add(drop.source);
      
      if (drop.type === 'sponsored') sponsorCount++;
    }

    // 5. Ensure diversity - add exploration slot if needed
    if (finalDrops.length < (params.limit || 10)) {
      const unusedSources = rankedDrops.filter(d => 
        !usedSources.has(d.source) && 
        !finalDrops.some(f => f.id === d.id)
      );
      
      for (const drop of unusedSources) {
        if (finalDrops.length >= (params.limit || 5)) break;
        finalDrops.push({
          ...drop,
          reason_for_ranking: 'Exploration • ' + drop.reason_for_ranking
        });
        usedSources.add(drop.source);
      }
    }

    console.log('[Ranking] Returning', finalDrops.length, 'ranked drops');

    return new Response(
      JSON.stringify({
        ranked_drops: finalDrops,
        total_candidates: drops.length,
        constraints_applied: {
          youtube_items: youtubeCount,
          max_per_source: 2,
          total_sources: usedSources.size
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Ranking] Unexpected error:', error);
    console.error('[Ranking] Error stack:', error.stack);
    console.error('[Ranking] Error details:', JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        ranked_drops: [] // Always include this for consistency
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});