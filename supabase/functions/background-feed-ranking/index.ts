import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { trigger = 'manual', users_limit, user_id } = requestBody;
    
    console.log(`[Background] Starting feed ranking - trigger: ${trigger}, users_limit: ${users_limit}, user_id: ${user_id}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let usersQuery = supabaseClient
      .from('preferences')
      .select('user_id')
      .not('selected_topic_ids', 'is', null)
      .neq('selected_topic_ids', '{}');

    // Handle specific triggers
    if (trigger === 'onboarding_completed' && user_id) {
      // Process only the specific user who just completed onboarding
      usersQuery = usersQuery.eq('user_id', user_id);
      console.log(`[Background] Processing single user after onboarding: ${user_id}`);
    } else if (trigger === 'preload' && users_limit) {
      // Pre-load for a limited number of users (oldest cache first)
      const { data: usersWithOldCache } = await supabaseClient
        .from('user_feed_cache')
        .select('user_id, created_at')
        .order('created_at', { ascending: true })
        .limit(users_limit);
      
      if (usersWithOldCache && usersWithOldCache.length > 0) {
        const userIds = usersWithOldCache.map(u => u.user_id);
        usersQuery = usersQuery.in('user_id', userIds);
        console.log(`[Background] Preloading for ${userIds.length} users with oldest cache`);
      }
    } else if (users_limit) {
      // Limit users for regular processing
      usersQuery = usersQuery.limit(users_limit);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      console.error('[Background] Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[Background] Processing', users?.length || 0, 'users');

    let processedUsers = 0;
    let totalCacheEntries = 0;

    // Process each user
    for (const user of users || []) {
      try {
        console.log('[Background] Processing user:', user.user_id);

        // Clear existing cache for this user
        await supabaseClient
          .from('user_feed_cache')
          .delete()
          .eq('user_id', user.user_id);

        // Get user preferences
        const { data: preferences } = await supabaseClient
          .from('preferences')
          .select('selected_topic_ids, selected_language_ids')
          .eq('user_id', user.user_id)
          .single();

        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('preference_embeddings')
          .eq('id', user.user_id)
          .single();

        // Get candidate drops (published in last 30 days, tagged)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: drops } = await supabaseClient
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
          .limit(500); // Increased limit for better cache coverage

        // Get user topic slugs once (for efficiency)
        let userTopicSlugs: string[] = [];
        let userL1TopicIds: number[] = [];
        let userL2TopicIds: number[] = [];
        
        if (preferences?.selected_topic_ids?.length > 0) {
          const { data: userTopics } = await supabaseClient
            .from('topics')
            .select('id, slug, level')
            .in('id', preferences.selected_topic_ids);

          if (userTopics) {
            userTopicSlugs = userTopics.map(t => t.slug.toLowerCase());
            userL1TopicIds = userTopics.filter(t => t.level === 1).map(t => t.id);
            userL2TopicIds = userTopics.filter(t => t.level === 2).map(t => t.id);
          }
        }

        if (!drops || drops.length === 0) continue;

        // Get source information
        const sourceIds = [...new Set(drops.map(d => d.source_id).filter(Boolean))];
        const { data: sources } = await supabaseClient
          .from('sources')
          .select('id, name, type')
          .in('id', sourceIds);

        const sourceMap = new Map(sources?.map(s => [s.id, s]) || []);

        // Calculate rankings for each drop
        const rankedDrops: any[] = [];

        for (const drop of drops) {
          try {
            // Base Score Calculation
            const publishedAt = new Date(drop.published_at || drop.created_at);
            const hoursOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
            
            const recencyScore = Math.exp(-hoursOld * Math.log(2) / 48);
            const trustScore = ((drop.authority_score || 0.5) + (drop.quality_score || 0.5)) / 2;
            const popularityScore = Math.log(1 + (drop.popularity_score || 0)) / Math.log(1000);
            
            const baseScore = (
              0.3 * Math.max(0, Math.min(1, recencyScore)) +
              0.25 * Math.max(0, Math.min(1, trustScore)) +
              0.15 * Math.max(0, Math.min(1, popularityScore))
            );

            // Personalization Score
            let personalScore = 0;
            const reasonFactors: string[] = [];

            // Hierarchical Topic matching (same as content-ranking)
            let topicMatch = 0;
            const matchedTopics: string[] = [];
            
            if (userTopicSlugs.length > 0) {
              // L1 topic match (highest priority)
              if (drop.l1_topic_id && userL1TopicIds.includes(drop.l1_topic_id)) {
                topicMatch = 1.0;
                matchedTopics.push('L1 topic');
              }
              // L2 topic match (high priority)
              else if (drop.l2_topic_id && userL2TopicIds.includes(drop.l2_topic_id)) {
                topicMatch = 0.8;
                matchedTopics.push('L2 topic');
              }
              // L3 tag match (medium priority)
              else if (drop.tags && drop.tags.length > 0) {
                const matchingTags = drop.tags.filter(tag => 
                  userTopicSlugs.includes(tag.toLowerCase())
                );
                if (matchingTags.length > 0) {
                  topicMatch = 0.6;
                  matchedTopics.push(`tags: ${matchingTags.slice(0, 2).join(', ')}`);
                }
              }
              
              if (topicMatch > 0) {
                reasonFactors.push(`Matches interests: ${matchedTopics.join(', ')}`);
              }
            }

            // Vector similarity calculation (using cosine similarity)
            let vectorSim = 0;
            if (profile?.preference_embeddings && drop.embeddings) {
              try {
                // Calculate cosine similarity between user preference embedding and drop embedding
                const { data: similarity } = await supabaseClient
                  .rpc('cosine_distance', {
                    vector1: profile.preference_embeddings,
                    vector2: drop.embeddings
                  });
                
                // Convert cosine distance to similarity (1 - distance)
                vectorSim = similarity ? Math.max(0, Math.min(1, 1 - similarity)) : 0;
                
                if (vectorSim > 0.7) {
                  reasonFactors.push('Content matches your reading patterns');
                }
              } catch (vectorErr) {
                console.warn('[Background] Vector similarity error for drop', drop.id, ':', vectorErr);
                vectorSim = 0.3; // Default similarity for content matching
              }
            } else {
              // If no embeddings available, use topic matching as proxy
              vectorSim = topicMatch > 0 ? 0.6 : 0.3;
            }

            // User feedback score
            let feedbackScore = 0;
            try {
              const { data: feedbackResult } = await supabaseClient
                .rpc('get_user_feedback_score', {
                  _user_id: user.user_id,
                  _drop_id: drop.id,
                  _source_id: drop.source_id || 0,
                  _tags: drop.tags || []
                });
              feedbackScore = feedbackResult || 0;
            } catch (feedbackErr) {
              console.warn('[Background] Feedback error for drop', drop.id, ':', feedbackErr);
            }

            if (feedbackScore > 0.1) {
              reasonFactors.push('Similar content liked before');
            }

            // Personal Score: 30% topic match + 35% vector similarity + 25% feedback + 10% diversity boost
            personalScore = (0.3 * topicMatch + 0.35 * vectorSim + 0.25 * feedbackScore + 0.1 * (usedSources.size < 3 ? 1 : 0.5));

            // Final Score: 35% base + 65% personal (more weight on personalization)
            const finalScore = 0.35 * baseScore + 0.65 * personalScore;

            // Add recency and quality factors to reasons
            if (hoursOld < 24) {
              reasonFactors.unshift('Fresh content');
            }
            if (trustScore > 0.7) {
              reasonFactors.push('High quality source');
            }

            const source = sourceMap.get(drop.source_id);
            rankedDrops.push({
              drop_id: drop.id,
              final_score: finalScore,
              reason_for_ranking: reasonFactors.slice(0, 2).join(' • ') || 'Relevant content',
              source_name: source?.name || 'Unknown Source',
              type: drop.type
            });

          } catch (error) {
            console.error('[Background] Error processing drop', drop.id, ':', error);
          }
        }

        // Sort by final score
        rankedDrops.sort((a, b) => b.final_score - a.final_score);

        // Apply constraints and diversity (similar to content-ranking)
        const finalDrops: any[] = [];
        const sourceCount = new Map<string, number>();
        const usedSources = new Set<string>();
        let youtubeCount = 0;

        // First pass: ensure at least 1 YouTube item
        const youtubeDrops = rankedDrops.filter(d => d.type === 'video');
        if (youtubeDrops.length > 0) {
          finalDrops.push(youtubeDrops[0]);
          youtubeCount++;
          sourceCount.set(youtubeDrops[0].source_name, 1);
          usedSources.add(youtubeDrops[0].source_name);
        }

        // Second pass: apply constraints (increase cache size to 50 items)
        for (const drop of rankedDrops) {
          if (finalDrops.length >= 50) break;
          
          if (finalDrops.some(d => d.drop_id === drop.drop_id)) continue;
          
          const currentSourceCount = sourceCount.get(drop.source_name) || 0;
          if (currentSourceCount >= 2) continue;
          
          finalDrops.push(drop);
          sourceCount.set(drop.source_name, currentSourceCount + 1);
          usedSources.add(drop.source_name);
        }

        // Save to cache
        const cacheEntries = finalDrops.map((drop, index) => ({
          user_id: user.user_id,
          drop_id: drop.drop_id,
          final_score: drop.final_score,
          reason_for_ranking: drop.reason_for_ranking,
          position: index + 1
        }));

        if (cacheEntries.length > 0) {
          const { error: cacheError } = await supabaseClient
            .from('user_feed_cache')
            .insert(cacheEntries);

          if (cacheError) {
            console.error('[Background] Cache save error for user', user.user_id, ':', cacheError);
          } else {
            totalCacheEntries += cacheEntries.length;
            console.log('[Background] Cached', cacheEntries.length, 'drops for user', user.user_id);
          }
        }

        processedUsers++;

      } catch (error) {
        console.error('[Background] Error processing user', user.user_id, ':', error);
      }
    }

    console.log(`[Background] Completed - Trigger: ${trigger}, Users: ${processedUsers}, Cache entries: ${totalCacheEntries}`);

    return new Response(
      JSON.stringify({
        success: true,
        trigger,
        processed_users: processedUsers,
        total_cache_entries: totalCacheEntries,
        message: `Background feed ranking completed (${trigger})`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Background] Unexpected error:', error);
    
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