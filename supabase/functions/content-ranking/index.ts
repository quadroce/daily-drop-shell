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
  refresh_cache?: boolean;
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
    let params: RankingParams = { limit: 5 };
    
    if (req.method === 'POST') {
      const body = await req.json();
      params = { ...params, ...body };
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = url.searchParams.get('limit');
      const user_id = url.searchParams.get('user_id');
      const refresh_cache = url.searchParams.get('refresh_cache');
      if (limit) params.limit = parseInt(limit);
      if (user_id) params.user_id = user_id;
      if (refresh_cache) params.refresh_cache = refresh_cache === 'true';
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
    const startTime = performance.now();
    let cacheCheckTime = 0;

    // Handle cache refresh if requested
    if (params.refresh_cache) {
      console.log('[Ranking] Refresh cache requested, clearing existing cache for user:', userId);
      const { error: deleteError } = await supabaseClient
        .from('user_feed_cache')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.warn('[Ranking] Error clearing cache:', deleteError);
      } else {
        console.log('[Ranking] Cache cleared successfully');
      }
    }

    // First, try to get from cache (unless refresh requested)
    if (!params.refresh_cache) {
      console.log('[Ranking] Checking cache for user:', userId);
      const cacheCheckStart = performance.now();
      
      // Step 1: Check if we have valid cache entries
      const currentTimestamp = new Date().toISOString();
      console.log('[Ranking] Current timestamp for cache check:', currentTimestamp);
      
      const { data: cacheEntries, error: cacheError } = await supabaseClient
        .from('user_feed_cache')
        .select('drop_id, final_score, reason_for_ranking, position, created_at, expires_at')
        .eq('user_id', userId)
        .gt('expires_at', currentTimestamp)
        .order('position', { ascending: true })
        .limit(params.limit || 5);

      cacheCheckTime = performance.now() - cacheCheckStart;
      console.log(`[Ranking] Cache check completed in ${cacheCheckTime.toFixed(2)}ms`);
      
      if (cacheError) {
        console.log('[Ranking] Cache query error:', cacheError);
      } else {
        console.log(`[Ranking] Cache query successful, found ${cacheEntries?.length || 0} entries`);
        if (cacheEntries && cacheEntries.length > 0) {
          console.log('[Ranking] First cache entry expires at:', cacheEntries[0].expires_at);
          console.log('[Ranking] Cache entries drop IDs:', cacheEntries.map(c => c.drop_id));
        }
      }

      if (!cacheError && cacheEntries && cacheEntries.length > 0) {
        console.log(`[Ranking] Found ${cacheEntries.length} valid cached entries, fetching drop details`);
        
        // Step 2: Get drop details for cached entries
        const dropIds = cacheEntries.map(c => c.drop_id);
        const dropsStart = performance.now();
        
        const { data: drops, error: dropsError } = await supabaseClient
          .from('drops')
          .select('id, title, url, image_url, summary, type, tags, source_id, published_at, created_at')
          .in('id', dropIds);
        
        const dropsTime = performance.now() - dropsStart;
        console.log(`[Ranking] Drop details fetch completed in ${dropsTime.toFixed(2)}ms, found ${drops?.length || 0} drops`);
        
        if (!dropsError && drops && drops.length > 0) {
          // Step 3: Get source information
          const sourceIds = [...new Set(drops.map(d => d.source_id).filter(Boolean))];
          const sourcesStart = performance.now();
          
          const { data: sources, error: sourcesError } = await supabaseClient
            .from('sources')
            .select('id, name, type')
            .in('id', sourceIds);
          
          const sourcesTime = performance.now() - sourcesStart;
          console.log(`[Ranking] Sources fetch completed in ${sourcesTime.toFixed(2)}ms, found ${sources?.length || 0} sources`);
          
          if (!sourcesError) {
            const sourceMap = new Map(sources?.map(s => [s.id, s]) || []);
            const dropMap = new Map(drops.map(d => [d.id, d]));
            
            // Step 4: Build ranked results maintaining cache order
            const rankedDrops = cacheEntries
              .map(cached => {
                const drop = dropMap.get(cached.drop_id);
                if (!drop) {
                  console.warn('[Ranking] Drop not found for cache entry:', cached.drop_id);
                  return null;
                }
                
                return {
                  id: drop.id,
                  title: drop.title,
                  source: sourceMap.get(drop.source_id)?.name || 'Unknown Source',
                  url: drop.url,
                  image_url: drop.image_url,
                  type: drop.type,
                  tags: drop.tags || [],
                  final_score: cached.final_score,
                  reason_for_ranking: cached.reason_for_ranking,
                  summary: drop.summary
                };
              })
              .filter(Boolean);

            const totalTime = performance.now() - startTime;
            console.log(`[Ranking] Successfully built ${rankedDrops.length} ranked drops from cache in ${totalTime.toFixed(2)}ms total`);

            return new Response(
              JSON.stringify({
                ranked_drops: rankedDrops,
                total_candidates: rankedDrops.length,
                from_cache: true,
                performance_ms: Math.round(totalTime),
                cache_details: {
                  cache_check_ms: Math.round(cacheCheckTime),
                  drops_fetch_ms: Math.round(dropsTime),
                  sources_fetch_ms: Math.round(sourcesTime),
                  cache_expires_at: cacheEntries[0]?.expires_at
                },
                constraints_applied: {
                  youtube_items: rankedDrops.filter(d => d.type === 'video').length,
                  max_per_source: 2,
                  total_sources: new Set(rankedDrops.map(d => d.source)).size
                }
              }),
              { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          } else {
            console.log('[Ranking] Sources fetch error:', sourcesError);
          }
        } else {
          console.log('[Ranking] Drops fetch error or no drops found:', dropsError);
        }
      } else {
        console.log('[Ranking] No valid cache entries found or cache error occurred');
      }
    }

    console.log('[Ranking] No valid cache found, calculating live ranking');
    const liveCalcStart = performance.now();

    // Get user preferences and profile
    const prefsStart = performance.now();
    const { data: preferences, error: prefsError } = await supabaseClient
      .from('preferences')
      .select('selected_topic_ids, selected_language_ids')
      .eq('user_id', userId)
      .single();

    const prefsTime = performance.now() - prefsStart;
    console.log(`[Ranking] Preferences fetch completed in ${prefsTime.toFixed(2)}ms`);
    
    if (prefsError || !preferences) {
      console.log('[Ranking] No preferences found, using default ranking');
    } else {
      console.log(`[Ranking] Found preferences: ${preferences.selected_topic_ids?.length || 0} topics, ${preferences.selected_language_ids?.length || 0} languages`);
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('preference_embeddings')
      .eq('id', userId)
      .single();

    // Get candidate drops (published in last 30 days, tagged)
    const candidatesStart = performance.now();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: drops, error: dropsError } = await supabaseClient
      .from('drops')
      .select(`
        id, title, url, image_url, summary, type, tags, 
        source_id, published_at, created_at,
        authority_score, quality_score, popularity_score, embeddings,
        l1_topic_id, l2_topic_id
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

    const candidatesTime = performance.now() - candidatesStart;
    console.log(`[Ranking] Candidates fetch completed in ${candidatesTime.toFixed(2)}ms`);

    if (!drops || drops.length === 0) {
      const totalTime = performance.now() - startTime;
      return new Response(
        JSON.stringify({ 
          ranked_drops: [], 
          total_candidates: 0,
          performance_ms: Math.round(totalTime)
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[Ranking] Processing ${drops.length} candidate drops for ranking`);

    // Get source information
    const sourceIds = [...new Set(drops.map(d => d.source_id).filter(Boolean))];
    const { data: sources } = await supabaseClient
      .from('sources')
      .select('id, name, type')
      .in('id', sourceIds);

    const sourceMap = new Map(sources?.map(s => [s.id, s]) || []);

    // PERFORMANCE OPTIMIZATION: Get user topics ONCE outside the loop
    let userTopicSlugs: string[] = [];
    let userTopicIds: Set<number> = new Set();
    let topicHierarchy: { level1: Set<number>, level2: Set<number>, level3: Set<string> } = {
      level1: new Set(),
      level2: new Set(), 
      level3: new Set()
    };

    if (preferences?.selected_topic_ids?.length > 0) {
      console.log(`[Ranking] Fetching topic details for ${preferences.selected_topic_ids.length} user preferences`);
      const topicsStart = performance.now();
      
      const { data: userTopics, error: topicsError } = await supabaseClient
        .from('topics')
        .select('id, slug, level, parent_id')
        .in('id', preferences.selected_topic_ids);

      const topicsTime = performance.now() - topicsStart;
      console.log(`[Ranking] User topics fetch completed in ${topicsTime.toFixed(2)}ms`);
      
      if (!topicsError && userTopics) {
        userTopicSlugs = userTopics.map(t => t.slug);
        userTopicIds = new Set(userTopics.map(t => t.id));
        
        // Build hierarchy sets for efficient matching
        userTopics.forEach(topic => {
          switch(topic.level) {
            case 1:
              topicHierarchy.level1.add(topic.id);
              break;
            case 2:
              topicHierarchy.level2.add(topic.id);
              break;
            case 3:
              topicHierarchy.level3.add(topic.slug);
              break;
          }
        });
        
        console.log(`[Ranking] Topic hierarchy built: L1=${topicHierarchy.level1.size}, L2=${topicHierarchy.level2.size}, L3=${topicHierarchy.level3.size}`);
      }
    }

    // Batch feedback scores for better performance
    const feedbackScores = new Map<number, number>();
    try {
      console.log('[Ranking] Pre-calculating feedback scores for performance...');
      const feedbackStart = performance.now();
      
      // We could batch this, but for now keep individual calls with better error handling
      for (const drop of drops.slice(0, 50)) { // Limit to top 50 candidates for performance
        try {
          const { data: feedbackResult } = await supabaseClient
            .rpc('get_user_feedback_score', {
              _user_id: userId,
              _drop_id: drop.id,
              _source_id: drop.source_id || 0,
              _tags: drop.tags || []
            });
          feedbackScores.set(drop.id, feedbackResult || 0);
        } catch (err) {
          feedbackScores.set(drop.id, 0);
        }
      }
      
      const feedbackTime = performance.now() - feedbackStart;
      console.log(`[Ranking] Feedback scores pre-calculated in ${feedbackTime.toFixed(2)}ms for ${feedbackScores.size} drops`);
    } catch (err) {
      console.warn('[Ranking] Feedback batch calculation failed:', err);
    }

    // Calculate rankings for each drop
    const scoringStart = performance.now();
    const rankedDrops: RankedDrop[] = [];
    let processedCount = 0;

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

        // IMPROVED HIERARCHICAL TOPIC MATCHING
        let topicMatch = 0;
        const matchDetails: string[] = [];
        
        if (preferences?.selected_topic_ids?.length > 0) {
          // Direct L1 topic match (highest priority)
          if (drop.l1_topic_id && topicHierarchy.level1.has(drop.l1_topic_id)) {
            topicMatch = Math.max(topicMatch, 1.0);
            matchDetails.push('L1-Direct');
            console.log(`[Ranking] Drop ${drop.id}: L1 direct match (${drop.l1_topic_id})`);
          }
          
          // Direct L2 topic match (medium priority)  
          if (drop.l2_topic_id && topicHierarchy.level2.has(drop.l2_topic_id)) {
            topicMatch = Math.max(topicMatch, 0.8);
            matchDetails.push('L2-Direct');
            console.log(`[Ranking] Drop ${drop.id}: L2 direct match (${drop.l2_topic_id})`);
          }
          
          // L3 tag matching (lower priority, but still valuable)
          const matchingTags = drop.tags?.filter(tag => 
            topicHierarchy.level3.has(tag) || 
            userTopicSlugs.some(slug => slug.toLowerCase() === tag.toLowerCase())
          ) || [];
          
          if (matchingTags.length > 0) {
            const tagScore = Math.min(0.6, 0.2 * matchingTags.length); // Max 0.6, scales with number of matches
            topicMatch = Math.max(topicMatch, tagScore);
            matchDetails.push(`L3-Tags(${matchingTags.length})`);
            console.log(`[Ranking] Drop ${drop.id}: L3 tag matches (${matchingTags.join(', ')})`);
          }
          
          // Build reason with specific matches
          if (topicMatch > 0) {
            const topMatches = matchingTags.slice(0, 2);
            if (topMatches.length > 0) {
              reasonFactors.push(`Matches interests: ${topMatches.join(', ')}`);
            } else {
              reasonFactors.push('Matches your topics');
            }
          }
          
          console.log(`[Ranking] Drop ${drop.id}: Topic score=${topicMatch.toFixed(3)} (${matchDetails.join(', ')})`);
        }

        // Vector similarity (if embeddings available)
        let vectorSim = 0;
        if (drop.embeddings && profile?.preference_embeddings) {
          // For now, use a placeholder - would implement actual cosine similarity
          vectorSim = 0.5; // Placeholder
        }

        // User feedback score (use pre-calculated values)
        const feedbackScore = feedbackScores.get(drop.id) || 0;

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

        // Enhanced reasoning with detailed logging
        if (hoursOld < 24) {
          reasonFactors.unshift('Fresh content');
        }
        if (trustScore > 0.7) {
          reasonFactors.push('High quality source');
        }
        
        // Detailed logging for top candidates
        if (finalScore > 0.3 || processedCount < 10) {
          console.log(`[Ranking] Drop ${drop.id} (${drop.title?.substring(0, 50)}...): 
            final=${finalScore.toFixed(3)} | base=${baseScore.toFixed(3)} | personal=${personalScore.toFixed(3)} | 
            topic=${topicMatch.toFixed(3)} | feedback=${feedbackScore.toFixed(3)} | 
            recency=${recencyScore.toFixed(3)} | trust=${trustScore.toFixed(3)} | hours=${hoursOld.toFixed(1)}`);
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
      processedCount++;
    }

    const scoringTime = performance.now() - scoringStart;
    console.log(`[Ranking] Scoring completed in ${scoringTime.toFixed(2)}ms - processed ${processedCount} drops, ranked ${rankedDrops.length}`);

    // Sort by final score
    rankedDrops.sort((a, b) => b.final_score - a.final_score);
    console.log(`[Ranking] Top 5 scores: ${rankedDrops.slice(0, 5).map(d => d.final_score.toFixed(3)).join(', ')}`);

    // 4. Apply Constraints and Diversity
    const constraintsStart = performance.now();
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
    if (finalDrops.length < (params.limit || 5)) {
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

    const constraintsTime = performance.now() - constraintsStart;
    console.log(`[Ranking] Constraints applied in ${constraintsTime.toFixed(2)}ms - final count: ${finalDrops.length}`);

    // 6. Cache the results for future requests (on-demand caching)
    const cachingStart = performance.now();
    try {
      // Prepare cache entries
      const cacheEntries = finalDrops.map((drop, index) => ({
        user_id: userId,
        drop_id: drop.id,
        final_score: drop.final_score,
        reason_for_ranking: drop.reason_for_ranking,
        position: index + 1,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours from now
      }));

      // Insert cache entries
      const { error: cacheInsertError } = await supabaseClient
        .from('user_feed_cache')
        .insert(cacheEntries);

      if (cacheInsertError) {
        console.error('[Ranking] Error caching results:', cacheInsertError);
      } else {
        console.log(`[Ranking] Successfully cached ${cacheEntries.length} entries for 2 hours`);
      }
    } catch (cacheError) {
      console.error('[Ranking] Exception while caching:', cacheError);
    }

    const cachingTime = performance.now() - cachingStart;
    const totalTime = performance.now() - startTime;
    console.log(`[Ranking] Caching completed in ${cachingTime.toFixed(2)}ms`);
    console.log(`[Ranking] Total live calculation time: ${totalTime.toFixed(2)}ms`);

    console.log('[Ranking] Returning', finalDrops.length, 'ranked drops');

    return new Response(
      JSON.stringify({
        ranked_drops: finalDrops,
        total_candidates: drops.length,
        from_cache: false,
        performance_ms: Math.round(totalTime),
        timing_breakdown: {
          cache_check_ms: Math.round(cacheCheckTime),
          preferences_ms: Math.round(prefsTime),
          candidates_ms: Math.round(candidatesTime),
          scoring_ms: Math.round(scoringTime),
          constraints_ms: Math.round(constraintsTime),
          caching_ms: Math.round(cachingTime)
        },
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