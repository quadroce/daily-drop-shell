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
    const { trigger = 'manual', users_limit, user_id, user_ids, smart_cache = true, force_regeneration = false } = requestBody;
    
    console.log(`[Background] Starting SMART feed ranking - trigger: ${trigger}, users_limit: ${users_limit}, user_id: ${user_id}, user_ids: ${user_ids?.length || 0}, smart_cache: ${smart_cache}, force_regeneration: ${force_regeneration}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let usersQuery = supabaseClient
      .from('preferences')
      .select('user_id')
      .not('selected_topic_ids', 'is', null)
      .neq('selected_topic_ids', '{}');

    // Handle specific triggers with smart priority
    if (trigger === 'onboarding_completed' && user_id) {
      // Process only the specific user who just completed onboarding
      usersQuery = usersQuery.eq('user_id', user_id);
      console.log(`[Background] Processing single user after onboarding: ${user_id}`);
    } else if (trigger === 'admin_regeneration' && user_ids && user_ids.length > 0) {
      // Process specific users requested by admin
      usersQuery = usersQuery.in('user_id', user_ids);
      console.log(`[Background] Processing ${user_ids.length} users requested by admin`);
    } else if (trigger === 'cron_optimized' || trigger === 'preload') {
      // Smart user selection: prioritize users with expired or insufficient cache
      const currentTime = new Date().toISOString();
      const { data: usersNeedingUpdate } = await supabaseClient.rpc('sql', {
        sql: `
          SELECT DISTINCT p.user_id, 
                 COALESCE(cache_stats.cache_count, 0) as cache_count,
                 COALESCE(cache_stats.oldest_cache, NOW() - INTERVAL '1 year') as oldest_cache
          FROM preferences p
          LEFT JOIN (
            SELECT user_id, 
                   COUNT(*) as cache_count,
                   MIN(created_at) as oldest_cache
            FROM user_feed_cache 
            WHERE expires_at > $1
            GROUP BY user_id
          ) cache_stats ON cache_stats.user_id = p.user_id
          WHERE p.selected_topic_ids IS NOT NULL 
            AND p.selected_topic_ids != '{}'
            AND (
              cache_stats.cache_count IS NULL 
              OR cache_stats.cache_count < 10 
              OR cache_stats.oldest_cache < $2
            )
          ORDER BY 
            CASE WHEN cache_stats.cache_count IS NULL THEN 0 ELSE cache_stats.cache_count END,
            cache_stats.oldest_cache
          LIMIT $3
        `,
        params: [currentTime, new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), users_limit || 20]
      });

      if (usersNeedingUpdate?.length > 0) {
        const userIds = usersNeedingUpdate.map((u: any) => u.user_id);
        usersQuery = usersQuery.in('user_id', userIds);
        console.log(`[Background] Smart targeting: ${userIds.length} users with expired/insufficient cache`);
      } else {
        console.log(`[Background] No users found needing cache update`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'All user caches are up to date',
            processed_users: 0,
            total_cache_entries: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
    let cachePreserved = 0;
    let cacheRegenerated = 0;

    // Process each user with SMART CACHE MANAGEMENT
    for (const user of users || []) {
      try {
        console.log('[Background] Processing user:', user.user_id);

        // SMART CACHE CHECK: Only proceed if cache needs update (unless force_regeneration is true)
        let shouldRegenerate = false;
        let existingCacheCount = 0;
        
        if (smart_cache && !force_regeneration) {
          const currentTime = new Date().toISOString();
          const { data: existingCache, error: cacheCheckError } = await supabaseClient
            .from('user_feed_cache')
            .select('drop_id, created_at, expires_at')
            .eq('user_id', user.user_id)
            .gt('expires_at', currentTime);

          if (cacheCheckError) {
            console.warn(`[Background] Cache check error for user ${user.user_id}:`, cacheCheckError);
            shouldRegenerate = true;
          } else {
            existingCacheCount = existingCache?.length || 0;
            
            // Regenerate if: no cache, insufficient cache (<10 items), or cache older than 6 hours
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
            const hasOldCache = existingCache?.some(c => new Date(c.created_at) < sixHoursAgo);
            
            shouldRegenerate = existingCacheCount < 10 || hasOldCache;
            
            console.log(`[Background] User ${user.user_id}: existing_cache=${existingCacheCount}, should_regenerate=${shouldRegenerate}`);
          }
        } else {
          // Legacy mode or force regeneration: always regenerate
          shouldRegenerate = true;
        }

        if (!shouldRegenerate) {
          console.log(`[Background] User ${user.user_id}: Cache is valid, skipping regeneration`);
          cachePreserved++;
          processedUsers++;
          continue;
        }

        // BACKUP existing cache before attempting regeneration (FALLBACK SYSTEM)
        let backupCache: any[] = [];
        if (smart_cache && existingCacheCount > 0) {
          const { data: backup } = await supabaseClient
            .from('user_feed_cache')
            .select('*')
            .eq('user_id', user.user_id);
          backupCache = backup || [];
          console.log(`[Background] Backed up ${backupCache.length} cache entries for user ${user.user_id}`);
        }

        // Clear existing cache ONLY after backup is secured
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

        // PERFORMANCE OPTIMIZATION: Get user topics with hierarchy (same as content-ranking)
        let userTopicSlugs: string[] = [];
        let topicHierarchy: { level1: Set<number>, level2: Set<number>, level3: Set<string> } = {
          level1: new Set(),
          level2: new Set(), 
          level3: new Set()
        };
        
        if (preferences?.selected_topic_ids?.length > 0) {
          const { data: userTopics } = await supabaseClient
            .from('topics')
            .select('id, slug, level')
            .in('id', preferences!.selected_topic_ids);

          if (userTopics) {
            userTopicSlugs = userTopics.map(t => t.slug);
            
            // Build hierarchy sets for efficient matching (same logic as content-ranking)
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
            
            console.log(`[Background] Topic hierarchy for user ${user.user_id}: L1=${topicHierarchy.level1.size}, L2=${topicHierarchy.level2.size}, L3=${topicHierarchy.level3.size}`);
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

        // PERFORMANCE OPTIMIZATION: Batch feedback scores (same as content-ranking)
        const feedbackScores = new Map<number, number>();
        try {
          console.log(`[Background] Pre-calculating feedback scores for user ${user.user_id}...`);
          const feedbackStart = performance.now();
          
          // Process top 50 drops for performance
          for (const drop of drops.slice(0, 50)) {
            try {
              const { data: feedbackResult } = await supabaseClient
                .rpc('get_user_feedback_score', {
                  _user_id: user.user_id,
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
          console.log(`[Background] Feedback scores pre-calculated in ${feedbackTime.toFixed(2)}ms for ${feedbackScores.size} drops`);
        } catch (err) {
          console.warn(`[Background] Feedback batch calculation failed for user ${user.user_id}:`, err);
        }

        // Calculate rankings for each drop
        const rankedDrops: any[] = [];
        const usedSources = new Set<string>();

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

            // IMPROVED HIERARCHICAL TOPIC MATCHING (unified with content-ranking)
            let topicMatch = 0;
            const matchDetails: string[] = [];
            
            if (preferences?.selected_topic_ids?.length > 0) {
              // Direct L1 topic match (highest priority)
              if (drop.l1_topic_id && topicHierarchy.level1.has(drop.l1_topic_id)) {
                topicMatch = Math.max(topicMatch, 1.0);
                matchDetails.push('L1-Direct');
                console.log(`[Background] Drop ${drop.id}: L1 direct match (${drop.l1_topic_id}) for user ${user.user_id}`);
              }
              // Direct L2 topic match (high priority)
              else if (drop.l2_topic_id && topicHierarchy.level2.has(drop.l2_topic_id)) {
                topicMatch = Math.max(topicMatch, 0.8);
                matchDetails.push('L2-Direct');
                console.log(`[Background] Drop ${drop.id}: L2 direct match (${drop.l2_topic_id}) for user ${user.user_id}`);
              }
              // L3 tag match (medium priority)
              else if (drop.tags && drop.tags.length > 0) {
                const matchingTags = drop.tags.filter((tag: string) => 
                  topicHierarchy.level3.has(tag)
                );
                if (matchingTags.length > 0) {
                  topicMatch = Math.max(topicMatch, 0.6);
                  matchDetails.push(`L3-Tags(${matchingTags.slice(0, 2).join(',')})`);
                  console.log(`[Background] Drop ${drop.id}: L3 tag match (${matchingTags.join(',')}) for user ${user.user_id}`);
                }
              }
              
              if (topicMatch > 0) {
                reasonFactors.push(`Matches interests: ${matchDetails.join(', ')}`);
              } else {
                console.log(`[Background] Drop ${drop.id}: Topic score=0.000 (no match) for user ${user.user_id}`);
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

            // User feedback score (using pre-calculated values for performance)
            const feedbackScore = feedbackScores.get(drop.id) || 0;

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

        // FALLBACK SYSTEM: Attempt to save new cache, restore backup if it fails
        if (cacheEntries.length > 0) {
          const { error: cacheError } = await supabaseClient
            .from('user_feed_cache')
            .insert(cacheEntries);

          if (cacheError) {
            console.error(`[Background] Cache save error for user ${user.user_id}:`, cacheError);
            
            // RESTORE BACKUP CACHE if new cache fails
            if (smart_cache && backupCache.length > 0) {
              console.log(`[Background] Restoring backup cache for user ${user.user_id} (${backupCache.length} entries)`);
              try {
                // Update expiration time for restored cache entries
                const restoredEntries = backupCache.map(entry => ({
                  ...entry,
                  expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours from now
                }));
                
                const { error: restoreError } = await supabaseClient
                  .from('user_feed_cache')
                  .insert(restoredEntries);
                
                if (!restoreError) {
                  totalCacheEntries += restoredEntries.length;
                  console.log(`[Background] Successfully restored ${restoredEntries.length} cache entries for user ${user.user_id}`);
                } else {
                  console.error(`[Background] Failed to restore backup for user ${user.user_id}:`, restoreError);
                }
              } catch (restoreErr) {
                console.error(`[Background] Backup restoration failed for user ${user.user_id}:`, restoreErr);
              }
            }
          } else {
            totalCacheEntries += cacheEntries.length;
            cacheRegenerated++;
            console.log(`[Background] Successfully cached ${cacheEntries.length} drops for user ${user.user_id}`);
          }
        } else {
          console.warn(`[Background] No cache entries generated for user ${user.user_id}, checking for backup restoration`);
          
          // If no new entries were generated but we have backup, restore it
          if (smart_cache && backupCache.length > 0) {
            console.log(`[Background] No new cache generated, restoring backup for user ${user.user_id}`);
            try {
              const restoredEntries = backupCache.map(entry => ({
                ...entry,
                expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
              }));
              
              const { error: restoreError } = await supabaseClient
                .from('user_feed_cache')
                .insert(restoredEntries);
              
              if (!restoreError) {
                totalCacheEntries += restoredEntries.length;
                console.log(`[Background] Restored backup cache for user ${user.user_id} (${restoredEntries.length} entries)`);
              }
            } catch (err) {
              console.error(`[Background] Emergency backup restoration failed for user ${user.user_id}:`, err);
            }
          }
        }

        processedUsers++;

      } catch (error) {
        console.error('[Background] Error processing user', user.user_id, ':', error);
      }
    }

    console.log(`[Background] SMART RANKING COMPLETED - Trigger: ${trigger}, Users: ${processedUsers}, Cache entries: ${totalCacheEntries}, Preserved: ${cachePreserved}, Regenerated: ${cacheRegenerated}`);

    return new Response(
      JSON.stringify({
        success: true,
        trigger,
        smart_cache_enabled: smart_cache,
        processed_users: processedUsers,
        total_cache_entries: totalCacheEntries,
        cache_preserved: cachePreserved,
        cache_regenerated: cacheRegenerated,
        performance_improvements: [
          "Smart cache validation - only regenerate when needed",
          "Fallback system - restore backup if regeneration fails", 
          "Unified topic matching algorithm",
          "Batch feedback scoring for better performance",
          "Hierarchical topic matching with Set() optimization"
        ],
        message: `Smart background feed ranking completed (${trigger})`
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
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});