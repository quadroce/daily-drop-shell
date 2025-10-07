import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Updated templates without URLs
const STATIC_TEMPLATES = [
  "Your video has been featured on DailyDrops under {TOPICS}!",
  "Great content! We've added this to DailyDrops in the {TOPICS} section.",
  "This video is now on DailyDrops, tagged as {TOPICS}.",
  "Featured on DailyDrops! Your video is tagged under {TOPICS}.",
  "Excellent work! We've included this in DailyDrops under {TOPICS}.",
  "Your video made it to DailyDrops in {TOPICS}!",
  "Featured in our {TOPICS} collection on DailyDrops.",
  "Tagged on DailyDrops under {TOPICS}.",
  "This video is part of DailyDrops' {TOPICS} section.",
  "Your content is now featured on DailyDrops ({TOPICS})."
];

const DAILY_CAP = 50;
const USE_AI_COMMENTS = true;

interface CommentJob {
  id: number;
  video_id: string;
  channel_id: string;
  video_title: string;
  video_description: string;
  topic_slug: string;
  text_hash: string;
  utm_campaign: string;
  utm_content: string;
  tries: number;
}

/**
 * Generate AI comment that informs creator their video is on DailyDrops
 */
async function generateAIComment(
  title: string,
  description: string,
  topicSlug: string,
  topicUrl: string,
  openaiKey: string
): Promise<string | null> {
  const topicName = topicSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  const prompt = `You're writing a brief YouTube comment (max 2 sentences) for DailyDrops.

CRITICAL REQUIREMENTS:
- MUST start with "Your video has been featured on DailyDrops"
- MUST mention it's tagged under "${topicName}"
- Keep it short and professional
- NO emojis
- Sound genuine, not promotional

Video: "${title}"
${description ? `Description: "${description.slice(0, 150)}"` : ''}

Write the comment now (2 sentences max):`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI_COMMENT_ERROR', { status: response.status, error: errorText });
      return null;
    }

    const data = await response.json();
    const aiComment = data.choices?.[0]?.message?.content?.trim();
    
    if (aiComment && aiComment.length > 10) {
      console.log('AI_COMMENT_SUCCESS', { length: aiComment.length });
      return aiComment;
    }
    
    return null;
  } catch (e) {
    console.error('AI_COMMENT_ERROR', {
      errorType: e.name,
      message: e.message
    });
    return null;
  }
}

/**
 * Pick random template and format with topic
 */
function pickRandomTemplate(topicSlug: string): string {
  const template = STATIC_TEMPLATES[Math.floor(Math.random() * STATIC_TEMPLATES.length)];
  const topicName = topicSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return template.replace('{TOPICS}', topicName);
}

/**
 * Log event to social_comment_events table
 */
async function logEvent(
  supabase: any,
  jobId: number,
  phase: string,
  status: string,
  message: string,
  data?: any
) {
  await supabase.from('social_comment_events').insert({
    job_id: jobId,
    phase,
    status,
    message,
    data: data || null
  });
}

/**
 * Post comment to YouTube using OAuth token
 */
async function postToYouTube(
  videoId: string,
  commentText: string,
  oauthToken: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            videoId: videoId,
            topLevelComment: {
              snippet: {
                textOriginal: commentText
              }
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('YOUTUBE_API_ERROR', {
        status: response.status,
        error: errorData
      });
      return {
        success: false,
        error: `YouTube API ${response.status}: ${errorData}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      commentId: data.id
    };
  } catch (error) {
    console.error('YOUTUBE_POST_ERROR', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Subscribe to YouTube channel
 */
async function subscribeToChannel(
  channelId: string,
  oauthToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/subscriptions?part=snippet',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            resourceId: {
              kind: 'youtube#channel',
              channelId: channelId
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      // Already subscribed is OK
      if (errorData?.error?.errors?.[0]?.reason === 'subscriptionDuplicate') {
        console.log('ALREADY_SUBSCRIBED', { channelId });
        return { success: true };
      }
      console.error('SUBSCRIBE_ERROR', { status: response.status, error: errorData });
      return {
        success: false,
        error: `Subscribe failed: ${errorData?.error?.message || response.statusText}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error('SUBSCRIBE_EXCEPTION', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Like YouTube video
 */
async function likeVideo(
  videoId: string,
  oauthToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('LIKE_ERROR', { status: response.status, error: errorData });
      return {
        success: false,
        error: `Like failed: ${response.status}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error('LIKE_EXCEPTION', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get fresh access token from cache
    const { data: tokenCache, error: tokenError } = await supabase
      .from('youtube_oauth_cache')
      .select('access_token, expires_at')
      .eq('id', 1)
      .maybeSingle();

    if (tokenError) {
      console.error('❌ Error fetching cached token:', tokenError);
    }

    let youtubeToken: string | null = null;

    if (tokenCache) {
      const expiresAt = new Date(tokenCache.expires_at);
      if (expiresAt > new Date()) {
        youtubeToken = tokenCache.access_token;
        console.log('✅ Using cached token, expires at:', expiresAt.toISOString());
      } else {
        console.log('⚠️ Cached token expired, will mark job as ready for manual posting');
      }
    } else {
      console.log('⚠️ No cached token found, will mark job as ready for manual posting');
    }

    // Check daily cap
    const { data: countData } = await supabase.rpc('get_youtube_comments_today_count');
    const todayCount = countData || 0;

    if (todayCount >= DAILY_CAP) {
      console.log('RATE_LIMIT_SKIP', { todayCount, dailyCap: DAILY_CAP });
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'Daily cap reached',
        todayCount,
        dailyCap: DAILY_CAP
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pending jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('social_comment_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (jobsError) {
      console.error('JOBS_QUERY_ERROR', { error: jobsError });
      return new Response(JSON.stringify({ error: jobsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending jobs',
        todayCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const job = jobs[0] as CommentJob;
    
    // Mark as processing
    await supabase
      .from('social_comment_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    await logEvent(supabase, job.id, 'START', 'info', 'Processing job', { videoId: job.video_id });

    // Build topic URL
    const topicUrl = `https://dailydrops.cloud/topic/${job.topic_slug}?utm_source=youtube&utm_medium=comment&utm_campaign=${job.utm_campaign}&utm_content=${job.utm_content}`;

    // Generate comment text
    let textOriginal: string;

    if (USE_AI_COMMENTS && openaiKey) {
      const aiComment = await generateAIComment(
        job.video_title,
        job.video_description,
        job.topic_slug,
        topicUrl,
        openaiKey
      );

      if (aiComment) {
        textOriginal = aiComment;
        await logEvent(supabase, job.id, 'GENERATION', 'success', 'AI comment generated', { length: aiComment.length });
      } else {
        textOriginal = pickRandomTemplate(job.topic_slug);
        await logEvent(supabase, job.id, 'GENERATION', 'fallback', 'Using fallback template');
      }
    } else {
      textOriginal = pickRandomTemplate(job.topic_slug);
      await logEvent(supabase, job.id, 'GENERATION', 'template', 'Using static template');
    }

    console.log('COMMENT_GENERATED', { 
      jobId: job.id, 
      preview: textOriginal.slice(0, 100) 
    });

    // Attempt to post to YouTube if OAuth token is available
    if (youtubeToken) {
      console.log('POSTING_TO_YOUTUBE', { jobId: job.id, videoId: job.video_id });
      
      const postResult = await postToYouTube(job.video_id, textOriginal, youtubeToken);

      if (postResult.success) {
        // Successfully posted comment
        await logEvent(supabase, job.id, 'POSTED', 'success', 'Comment posted to YouTube', { 
          commentId: postResult.commentId 
        });

        // Subscribe to channel
        console.log('SUBSCRIBING_TO_CHANNEL', { jobId: job.id, channelId: job.channel_id });
        const subscribeResult = await subscribeToChannel(job.channel_id, youtubeToken);
        
        if (subscribeResult.success) {
          await logEvent(supabase, job.id, 'SUBSCRIBE', 'success', 'Subscribed to channel');
        } else {
          await logEvent(supabase, job.id, 'SUBSCRIBE', 'warning', 'Subscribe failed', { 
            error: subscribeResult.error 
          });
        }

        // Like video
        console.log('LIKING_VIDEO', { jobId: job.id, videoId: job.video_id });
        const likeResult = await likeVideo(job.video_id, youtubeToken);
        
        if (likeResult.success) {
          await logEvent(supabase, job.id, 'LIKE', 'success', 'Liked video');
        } else {
          await logEvent(supabase, job.id, 'LIKE', 'warning', 'Like failed', { 
            error: likeResult.error 
          });
        }

        // Update job as posted
        await supabase
          .from('social_comment_jobs')
          .update({ 
            text_original: textOriginal,
            external_comment_id: postResult.commentId,
            status: 'posted',
            posted_at: new Date().toISOString(),
            tries: job.tries + 1
          })
          .eq('id', job.id);

        console.log('POSTED_SUCCESS', { 
          jobId: job.id, 
          commentId: postResult.commentId,
          subscribed: subscribeResult.success,
          liked: likeResult.success
        });

        return new Response(JSON.stringify({ 
          success: true, 
          jobId: job.id,
          videoId: job.video_id,
          commentId: postResult.commentId,
          subscribed: subscribeResult.success,
          liked: likeResult.success,
          status: 'posted',
          todayCount: todayCount + 1
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Failed to post
        await supabase
          .from('social_comment_jobs')
          .update({ 
            text_original: textOriginal,
            status: 'error',
            last_error: postResult.error,
            tries: job.tries + 1,
            next_retry_at: new Date(Date.now() + 3600000).toISOString() // Retry in 1 hour
          })
          .eq('id', job.id);

        await logEvent(supabase, job.id, 'POST', 'error', 'Failed to post to YouTube', { 
          error: postResult.error 
        });

        return new Response(JSON.stringify({ 
          success: false, 
          error: postResult.error,
          jobId: job.id
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // No OAuth token - mark as ready for manual posting
      await supabase
        .from('social_comment_jobs')
        .update({ 
          text_original: textOriginal,
          status: 'ready',
          last_error: 'YouTube OAuth token not configured',
          tries: job.tries + 1
        })
        .eq('id', job.id);

      await logEvent(supabase, job.id, 'READY', 'warning', 'Comment ready - OAuth not configured');

      console.log('COMMENT_READY_NO_OAUTH', { 
        jobId: job.id, 
        videoId: job.video_id 
      });

      return new Response(JSON.stringify({ 
        success: true, 
        jobId: job.id,
        videoId: job.video_id,
        textPreview: textOriginal.slice(0, 100),
        status: 'ready',
        message: 'Comment generated but not posted (OAuth not configured)',
        todayCount: todayCount + 1
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('WORKER_ERROR', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
