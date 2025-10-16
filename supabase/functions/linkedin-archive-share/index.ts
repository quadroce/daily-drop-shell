import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopicCand {
  topic_id: number;
  topic_slug: string;
  topic_label: string;
  article_count: number;
  latest_updated: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { slot, trigger } = await req.json();
    console.log(`[LinkedIn Archive Share] Started: slot=${slot}, trigger=${trigger}`);

    // 1. Check if feature is enabled
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'linkedin_archive_enabled')
      .single();

    if (!setting || setting.value?.enabled === false) {
      console.log('[LinkedIn Archive Share] Feature disabled, skipping');
      return new Response(JSON.stringify({ skipped: true, reason: 'feature_disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Calculate yesterday's window in Europe/Rome timezone
    const now = new Date();
    const romeOffset = 1; // CET = UTC+1, CEST = UTC+2 (simplified; production should use proper timezone lib)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0 + romeOffset, 0, 0, 0);
    const windowStart = yesterday.toISOString();
    const windowEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const dateKey = yesterday.toISOString().split('T')[0];

    console.log(`[Selection Window] ${windowStart} to ${windowEnd} (${dateKey})`);

    // 3. Select top 2 topics by article count from yesterday
    const { data: candidates, error: selectError } = await supabase.rpc('get_top_topics_by_date', {
      p_start_date: windowStart,
      p_end_date: windowEnd,
      p_limit: 2
    });

    if (selectError) {
      console.error('[Selection Error]', selectError);
      throw new Error(`Topic selection failed: ${selectError.message}`);
    }

    if (!candidates || candidates.length === 0) {
      console.log('[No Topics] No topics found for yesterday');
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: 'no_topics', 
        window: { start: windowStart, end: windowEnd }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Selected Topics] Found ${candidates.length} topics:`, 
      candidates.map((c: TopicCand) => `${c.topic_slug} (${c.article_count} articles)`));

    // 4. Determine which topic to post based on slot
    const slotIndex = slot === 'morning' ? 0 : 1;
    if (slotIndex >= candidates.length) {
      console.log(`[Skipped] Only ${candidates.length} topic(s) available for ${slot} slot`);
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: 'insufficient_topics',
        available: candidates.length,
        requested_slot: slotIndex + 1
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const selectedTopic: TopicCand = candidates[slotIndex];
    console.log(`[Topic Selected] ${selectedTopic.topic_slug} (${selectedTopic.article_count} articles)`);

    // 5. Check if we already posted for this topic/date/slot
    const slotTime = slot === 'morning' 
      ? new Date(`${dateKey}T12:05:00+01:00`)
      : new Date(`${dateKey}T17:16:00+01:00`);

    const { data: existing } = await supabase
      .from('social_posts')
      .select('id, status')
      .eq('platform', 'linkedin')
      .eq('kind', 'archive_share')
      .eq('topic_slug', selectedTopic.topic_slug)
      .eq('date_key', dateKey)
      .eq('slot_time', slotTime.toISOString())
      .maybeSingle();

    if (existing && existing.status === 'posted') {
      console.log(`[Already Posted] Post ${existing.id} already exists`);
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: 'already_posted',
        post_id: existing.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. Create/update post record
    const postRecord = {
      platform: 'linkedin',
      kind: 'archive_share',
      topic_id: selectedTopic.topic_id,
      topic_slug: selectedTopic.topic_slug,
      date_key: dateKey,
      window_start: windowStart,
      window_end: windowEnd,
      slot_time: slotTime.toISOString(),
      article_count: selectedTopic.article_count,
      status: 'processing'
    };

    const { data: post, error: postError } = existing
      ? await supabase.from('social_posts').update(postRecord).eq('id', existing.id).select().single()
      : await supabase.from('social_posts').insert(postRecord).select().single();

    if (postError || !post) {
      throw new Error(`Failed to create post record: ${postError?.message}`);
    }

    const logEvent = async (phase: string, status: string, message: string, data?: any) => {
      await supabase.from('social_post_events').insert({
        post_id: post.id,
        phase,
        status,
        message,
        data
      });
    };

    await logEvent('selection', 'ok', `Selected topic ${selectedTopic.topic_slug} with ${selectedTopic.article_count} articles`, {
      candidates: candidates.length,
      slot_index: slotIndex
    });

    // 7. Get or generate daily summary
    let summary: string | null = null;
    const { data: summaryData } = await supabase
      .from('daily_topic_summaries')
      .select('summary_en')
      .eq('topic_slug', selectedTopic.topic_slug)
      .eq('date', dateKey)
      .maybeSingle();

    if (summaryData?.summary_en) {
      summary = summaryData.summary_en;
      await logEvent('composition', 'ok', 'Using existing daily summary');
    } else {
      // Fallback: Generate simple summary from yesterday's articles
      console.log('[Summary] No pre-generated summary, creating fallback');
      summary = `Yesterday in ${selectedTopic.topic_label}: ${selectedTopic.article_count} key updates. Explore the latest developments and insights.`;
      await logEvent('composition', 'warn', 'Used fallback summary (no pre-generated summary found)');
    }

    // 8. Build post content
    const archiveUrl = `https://dailydrops.cloud/topics/${selectedTopic.topic_slug}/${dateKey}`;
    const utmParams = {
      utm_source: 'linkedin',
      utm_medium: 'post',
      utm_campaign: `archive-${selectedTopic.topic_slug}`,
      utm_content: dateKey.replace(/-/g, '')
    };
    const utmString = new URLSearchParams(utmParams).toString();
    const trackingUrl = `${archiveUrl}?${utmString}`;

    // Compose post text (English only, no emojis)
    const postText = `${summary}

Read the full archive: ${trackingUrl}

#${selectedTopic.topic_slug.replace(/-/g, '')} #dailydrops`;

    await logEvent('composition', 'ok', 'Post text composed', { 
      length: postText.length,
      url: trackingUrl
    });

    // 9. Publish to LinkedIn (UGC text post)
    const linkedinAccessToken = Deno.env.get('LINKEDIN_ACCESS_TOKEN');
    const linkedinPageUrn = Deno.env.get('LINKEDIN_PAGE_URN');

    console.log('[LinkedIn Config]', { 
      hasToken: !!linkedinAccessToken, 
      urnFormat: linkedinPageUrn?.substring(0, 30) + '...' 
    });

    if (!linkedinAccessToken || !linkedinPageUrn) {
      await logEvent('posting', 'error', 'LinkedIn credentials not configured');
      await supabase.from('social_posts').update({
        status: 'failed',
        error_message: 'LinkedIn credentials not configured'
      }).eq('id', post.id);
      
      throw new Error('LinkedIn credentials not configured');
    }

    // Validate URN format (must be urn:li:organization:ID)
    if (!linkedinPageUrn.startsWith('urn:li:organization:')) {
      const errMsg = `Invalid URN format. Expected 'urn:li:organization:ID', got: ${linkedinPageUrn.substring(0, 50)}`;
      console.error('[URN Format Error]', errMsg);
      await logEvent('posting', 'error', errMsg);
      await supabase.from('social_posts').update({
        status: 'failed',
        error_message: errMsg
      }).eq('id', post.id);
      
      throw new Error(errMsg);
    }

    // Create post using new Posts API (not deprecated UGC API)
    const postsPayload = {
      author: linkedinPageUrn,
      commentary: postText,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      content: {
        article: {
          source: trackingUrl,
          title: selectedTopic.topic_label,
          description: summary.substring(0, 200) // LinkedIn max 200 chars for article description
        }
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false
    };

    console.log('[LinkedIn API] Posting via Posts API...', {
      author: postsPayload.author,
      commentaryLength: postText.length,
      articleUrl: trackingUrl
    });
    
    const postResponse = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202501' // Format: YYYYMM
      },
      body: JSON.stringify(postsPayload)
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('[LinkedIn API Error]', postResponse.status, errorText);
      await logEvent('posting', 'error', `LinkedIn API error: ${postResponse.status}`, { error: errorText });
      await supabase.from('social_posts').update({
        status: 'failed',
        error_message: `LinkedIn API error: ${errorText.substring(0, 500)}`
      }).eq('id', post.id);
      
      throw new Error(`LinkedIn API error: ${postResponse.status} ${errorText}`);
    }

    // Posts API returns 201 with post URN in x-restli-id header
    const linkedinUrn = postResponse.headers.get('x-restli-id');
    if (!linkedinUrn) {
      console.error('[LinkedIn API] No x-restli-id in response headers');
      throw new Error('LinkedIn API did not return post URN');
    }
    
    const linkedinUrl = `https://www.linkedin.com/feed/update/${linkedinUrn}`;

    console.log('[Posted Successfully]', linkedinUrn);
    await logEvent('posting', 'ok', 'Posted to LinkedIn', { urn: linkedinUrn });

    // 10. Update post record as successful
    await supabase.from('social_posts').update({
      status: 'posted',
      external_id: linkedinUrn,
      post_text: postText,
      post_url: linkedinUrl,
      utm_params: utmParams,
      payload_snapshot: postsPayload,
      posted_at: now.toISOString(),
      updated_at: now.toISOString()
    }).eq('id', post.id);

    console.log('[Complete] LinkedIn archive share posted successfully');

    return new Response(JSON.stringify({
      success: true,
      post_id: post.id,
      topic: selectedTopic.topic_slug,
      article_count: selectedTopic.article_count,
      linkedin_urn: linkedinUrn,
      linkedin_url: linkedinUrl,
      slot
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Fatal Error]', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
