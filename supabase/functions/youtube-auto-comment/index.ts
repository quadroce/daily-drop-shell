import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Static fallback templates (no URLs, emojis, or hashtags)
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
  "Your content is now featured on DailyDrops ({TOPICS}).",
];

const DAILY_CAP = 50;
const USE_AI_COMMENTS = true;
const COMMENTS_MODEL = Deno.env.get("OPENAI_COMMENTS_MODEL") || "gpt-5";
const COMMENTS_TEMPERATURE = parseFloat(Deno.env.get("OPENAI_COMMENTS_TEMPERATURE") || "0.9");
const COMMENTS_MAX_TOKENS = parseInt(Deno.env.get("OPENAI_COMMENTS_MAX_TOKENS") || "120");
const DIVERSITY_DEDUPE = Deno.env.get("COMMENTS_DIVERSITY_DEDUPE") !== "false";

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
 * Generate SHA-256 hash for text deduplication
 */
async function generateTextHash(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a similar comment was posted recently (7-day window)
 */
async function isDuplicate(
  supabase: any,
  textHash: string,
  channelId: string,
): Promise<boolean> {
  if (!DIVERSITY_DEDUPE) return false;

  const { data, error } = await supabase
    .from("social_comment_jobs")
    .select("id")
    .eq("text_hash", textHash)
    .eq("channel_id", channelId)
    .eq("status", "posted")
    .gte("posted_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (error) {
    console.error("DEDUPE_CHECK_ERROR", error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Generate AI comment variants using GPT-5
 * Returns multiple variants (3-5) for randomization
 */
async function generateAICommentVariants(
  title: string,
  description: string,
  topicSlug: string,
  openaiKey: string,
): Promise<string[] | null> {
  const topicName = topicSlug.split("-").map((w) =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");

  const systemPrompt = `You write concise, authentic YouTube comments that build awareness without links, hashtags, or emojis.
Style: short (1-2 sentences), appreciative, non-promotional, natural variety.
Must mention the topic: "${topicName}".
Output: Return 3-5 alternatives, numbered 1..N, each on a single line.`;

  const userPrompt = `Title: "${title}"
${description ? `Description: "${description.slice(0, 200)}"` : ""}
Topic: ${topicName}

Additional guidance: No links, no emojis, no hashtags. Aim for awareness only.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COMMENTS_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_completion_tokens: COMMENTS_MAX_TOKENS,
        // Note: GPT-5 doesn't support temperature parameter
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI_VARIANTS_ERROR", {
        status: response.status,
        model: COMMENTS_MODEL,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content?.trim();

    if (!rawText) {
      console.error("AI_VARIANTS_EMPTY");
      return null;
    }

    // Parse numbered variants
    const lines = rawText.split("\n").filter(l => l.trim());
    const variants = lines
      .map(l => l.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter(l => l.length > 10 && l.length < 300); // Reasonable length

    if (variants.length > 0) {
      console.log("AI_VARIANTS_SUCCESS", { 
        count: variants.length,
        model: COMMENTS_MODEL,
        rawLength: rawText.length 
      });
      return variants;
    }

    return null;
  } catch (e) {
    console.error("AI_VARIANTS_ERROR", {
      errorType: e.name,
      message: e.message,
      model: COMMENTS_MODEL,
    });
    return null;
  }
}

/**
 * Pick random template and format with topic
 */
function pickRandomTemplate(topicSlug: string): string {
  const template =
    STATIC_TEMPLATES[Math.floor(Math.random() * STATIC_TEMPLATES.length)];
  const topicName = topicSlug.split("-").map((w) =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");
  return template.replace("{TOPICS}", topicName);
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
  data?: any,
) {
  await supabase.from("social_comment_events").insert({
    job_id: jobId,
    phase,
    status,
    message,
    data: data || null,
  });
}

/**
 * Post comment to YouTube using OAuth token
 */
async function postToYouTube(
  videoId: string,
  commentText: string,
  oauthToken: string,
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            videoId: videoId,
            topLevelComment: {
              snippet: {
                textOriginal: commentText,
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("YOUTUBE_API_ERROR", {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: `YouTube API ${response.status}: ${errorData}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      commentId: data.id,
    };
  } catch (error) {
    console.error("YOUTUBE_POST_ERROR", { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Subscribe to YouTube channel
 */
async function subscribeToChannel(
  channelId: string,
  oauthToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            resourceId: {
              kind: "youtube#channel",
              channelId: channelId,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      // Already subscribed is OK
      if (errorData?.error?.errors?.[0]?.reason === "subscriptionDuplicate") {
        console.log("ALREADY_SUBSCRIBED", { channelId });
        return { success: true };
      }
      console.error("SUBSCRIBE_ERROR", {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: `Subscribe failed: ${
          errorData?.error?.message || response.statusText
        }`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("SUBSCRIBE_EXCEPTION", { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Like YouTube video
 */
async function likeVideo(
  videoId: string,
  oauthToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=like`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${oauthToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("LIKE_ERROR", {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: `Like failed: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("LIKE_EXCEPTION", { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get fresh access token from cache
    const { data: tokenCache, error: tokenError } = await supabase
      .from("youtube_oauth_cache")
      .select("access_token, expires_at")
      .eq("id", 1)
      .maybeSingle();

    if (tokenError) {
      console.error("❌ Error fetching cached token:", tokenError);
    }

    let youtubeToken: string | null = null;

    if (tokenCache) {
      const expiresAt = new Date(tokenCache.expires_at);
      if (expiresAt > new Date()) {
        youtubeToken = tokenCache.access_token;
        console.log(
          "✅ Using cached token, expires at:",
          expiresAt.toISOString(),
        );
      } else {
        console.log(
          "⚠️ Cached token expired, will mark job as ready for manual posting",
        );
      }
    } else {
      console.log(
        "⚠️ No cached token found, will mark job as ready for manual posting",
      );
    }

    // Check daily cap
    const { data: countData } = await supabase.rpc(
      "get_youtube_comments_today_count",
    );
    const todayCount = countData || 0;

    if (todayCount >= DAILY_CAP) {
      console.log("RATE_LIMIT_SKIP", { todayCount, dailyCap: DAILY_CAP });
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Daily cap reached",
          todayCount,
          dailyCap: DAILY_CAP,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Reset stuck jobs (processing for more than 10 minutes)
    const { data: resetCount, error: resetError } = await supabase
      .rpc('reset_stuck_comment_jobs');
    
    if (resetError) {
      console.error('⚠️ Error resetting stuck jobs:', resetError);
      // Log but don't fail - continue processing
    } else if (resetCount && resetCount > 0) {
      console.log(`🔄 Reset ${resetCount} stuck job(s) from processing to queued`);
    }

    // Get pending jobs that are due (scheduled_for <= now OR no schedule)
    const now = new Date().toISOString();
    const { data: jobs, error: jobsError } = await supabase
      .from("social_comment_jobs")
      .select("*")
      .eq("status", "queued")
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .limit(1);

    if (jobsError) {
      console.error("JOBS_QUERY_ERROR", { error: jobsError });
      return new Response(JSON.stringify({ error: jobsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending jobs",
          todayCount,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const job = jobs[0] as CommentJob;

    // Check if this video already has a posted OR processing comment (prevent duplicates)
    const { data: existingComments, error: duplicateCheckError } = await supabase
      .from("social_comment_jobs")
      .select("id, status")
      .eq("video_id", job.video_id)
      .neq("id", job.id) // Exclude current job
      .in("status", ["posted", "processing"])
      .limit(1);

    if (!duplicateCheckError && existingComments && existingComments.length > 0) {
      console.log("DUPLICATE_VIDEO_SKIP", {
        jobId: job.id,
        videoId: job.video_id,
        existingJobId: existingComments[0].id,
        existingStatus: existingComments[0].status,
      });
      
      // Mark this job as failed to prevent retry
      await supabase
        .from("social_comment_jobs")
        .update({
          status: "failed",
          last_error: `Video already has a ${existingComments[0].status} comment (job ${existingComments[0].id})`,
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({
          success: false,
          reason: "Video already has an active comment job",
          jobId: job.id,
          existingJobId: existingComments[0].id,
          existingStatus: existingComments[0].status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("PROCESSING_JOB", {
      jobId: job.id,
      videoId: job.video_id,
      topicSlug: job.topic_slug,
      tries: job.tries,
    });

    // CRITICAL: Mark as processing ONLY IF still queued (prevents race conditions)
    const { error: processingError } = await supabase
      .from("social_comment_jobs")
      .update({ 
        status: "processing",
        tries: job.tries + 1
      })
      .eq("id", job.id)
      .eq("status", "queued"); // Only update if still queued

    if (processingError) {
      console.error("PROCESSING_UPDATE_ERROR", {
        jobId: job.id,
        error: processingError,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to mark job as processing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify we got the lock by checking if status changed to processing
    const { data: verifyData, error: verifyError } = await supabase
      .from("social_comment_jobs")
      .select("status, external_comment_id")
      .eq("id", job.id)
      .single();

    if (verifyError || !verifyData || verifyData.status !== "processing") {
      console.log("LOCK_FAILED - Another instance is processing this job", {
        jobId: job.id,
        currentStatus: verifyData?.status,
      });
      return new Response(
        JSON.stringify({
          success: false,
          message: "Job already being processed by another instance",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // CRITICAL: Check if comment was already posted (prevents double-posting)
    if (verifyData.external_comment_id) {
      console.error("ALREADY_POSTED", {
        jobId: job.id,
        commentId: verifyData.external_comment_id,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Comment already posted",
          commentId: verifyData.external_comment_id,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await logEvent(supabase, job.id, "START", "info", "Processing job", {
      videoId: job.video_id,
    });

    // Generate comment text with GPT-5 variants
    let textOriginal: string;
    let textVariant: string | null = null;
    let textHash: string;

    if (USE_AI_COMMENTS && openaiKey) {
      let variants = await generateAICommentVariants(
        job.video_title,
        job.video_description,
        job.topic_slug,
        openaiKey,
      );

      if (variants && variants.length > 0) {
        // Pick random variant
        const selectedVariant = variants[Math.floor(Math.random() * variants.length)];
        textHash = await generateTextHash(selectedVariant);

        // Check for duplicates
        const isDupe = await isDuplicate(supabase, textHash, job.channel_id);
        
        if (isDupe) {
          console.log("DUPLICATE_DETECTED", { textHash, jobId: job.id });
          
          // Try regenerating once
          await logEvent(
            supabase,
            job.id,
            "GENERATION",
            "warning",
            "Duplicate detected, regenerating",
            { textHash },
          );

          variants = await generateAICommentVariants(
            job.video_title,
            job.video_description,
            job.topic_slug,
            openaiKey,
          );

          if (variants && variants.length > 0) {
            const newVariant = variants[Math.floor(Math.random() * variants.length)];
            const newHash = await generateTextHash(newVariant);
            
            if (!await isDuplicate(supabase, newHash, job.channel_id)) {
              textOriginal = newVariant;
              textHash = newHash;
              textVariant = variants.join("\n\n---\n\n"); // Store all variants
            } else {
              // Still duplicate, use fallback
              textOriginal = pickRandomTemplate(job.topic_slug);
              textHash = await generateTextHash(textOriginal);
              await logEvent(
                supabase,
                job.id,
                "GENERATION",
                "fallback",
                "Still duplicate after retry, using template",
              );
            }
          } else {
            textOriginal = pickRandomTemplate(job.topic_slug);
            textHash = await generateTextHash(textOriginal);
          }
        } else {
          textOriginal = selectedVariant;
          textVariant = variants.join("\n\n---\n\n");
          
          await logEvent(
            supabase,
            job.id,
            "GENERATION",
            "success",
            `AI variants generated (${variants.length})`,
            { 
              model: COMMENTS_MODEL,
              variantCount: variants.length,
              selectedLength: textOriginal.length,
              textHash,
            },
          );
        }
      } else {
        textOriginal = pickRandomTemplate(job.topic_slug);
        textHash = await generateTextHash(textOriginal);
        await logEvent(
          supabase,
          job.id,
          "GENERATION",
          "fallback",
          "AI generation failed, using template",
        );
      }
    } else {
      textOriginal = pickRandomTemplate(job.topic_slug);
      textHash = await generateTextHash(textOriginal);
      await logEvent(
        supabase,
        job.id,
        "GENERATION",
        "template",
        "Using static template (AI disabled)",
      );
    }

    console.log("COMMENT_GENERATED", {
      jobId: job.id,
      preview: textOriginal.slice(0, 100),
    });

    // Attempt to post to YouTube if OAuth token is available
    if (youtubeToken) {
      console.log("POSTING_TO_YOUTUBE", {
        jobId: job.id,
        videoId: job.video_id,
      });

      const postResult = await postToYouTube(
        job.video_id,
        textOriginal,
        youtubeToken,
      );

      if (postResult.success) {
        // Successfully posted comment
        await logEvent(
          supabase,
          job.id,
          "POSTED",
          "success",
          "Comment posted to YouTube",
          {
            commentId: postResult.commentId,
          },
        );

        // Subscribe to channel
        console.log("SUBSCRIBING_TO_CHANNEL", {
          jobId: job.id,
          channelId: job.channel_id,
        });
        const subscribeResult = await subscribeToChannel(
          job.channel_id,
          youtubeToken,
        );

        if (subscribeResult.success) {
          await logEvent(
            supabase,
            job.id,
            "SUBSCRIBE",
            "success",
            "Subscribed to channel",
          );
        } else {
          await logEvent(
            supabase,
            job.id,
            "SUBSCRIBE",
            "warning",
            "Subscribe failed",
            {
              error: subscribeResult.error,
            },
          );
        }

        // Like video
        console.log("LIKING_VIDEO", { jobId: job.id, videoId: job.video_id });
        const likeResult = await likeVideo(job.video_id, youtubeToken);

        if (likeResult.success) {
          await logEvent(supabase, job.id, "LIKE", "success", "Liked video");
        } else {
          await logEvent(supabase, job.id, "LIKE", "warning", "Like failed", {
            error: likeResult.error,
          });
        }

        // Update job as posted with all metadata
        // Add job ID to text_hash to ensure uniqueness (prevent constraint violations)
        const uniqueTextHash = `${textHash}_${job.id}`;
        
        const { error: updateError } = await supabase
          .from("social_comment_jobs")
          .update({
            text_original: textOriginal,
            text_variant: textVariant,
            text_hash: uniqueTextHash,
            external_comment_id: postResult.commentId,
            status: "posted",
            posted_at: new Date().toISOString(),
            tries: job.tries + 1,
          })
          .eq("id", job.id);

        if (updateError) {
          console.error("UPDATE_ERROR", {
            jobId: job.id,
            error: updateError,
          });
          
          // Try one more time with a timestamped hash to avoid conflicts
          const timestampedHash = `${textHash}_${job.id}_${Date.now()}`;
          const { error: retryUpdateError } = await supabase
            .from("social_comment_jobs")
            .update({
              text_original: textOriginal,
              text_variant: textVariant,
              text_hash: timestampedHash,
              external_comment_id: postResult.commentId,
              status: "posted",
              posted_at: new Date().toISOString(),
              tries: job.tries + 1,
            })
            .eq("id", job.id);
          
          if (retryUpdateError) {
            await logEvent(
              supabase,
              job.id,
              "UPDATE",
              "error",
              "Failed to update job status to posted (retry also failed)",
              { error: retryUpdateError },
            );
            // Comment was posted successfully, just log the error but return success
            console.error("UPDATE_RETRY_ERROR", {
              jobId: job.id,
              error: retryUpdateError,
              note: "Comment was posted successfully despite DB update error",
            });
          } else {
            console.log("UPDATE_RETRY_SUCCESS", { jobId: job.id });
          }
        }

        console.log("POSTED_SUCCESS", {
          jobId: job.id,
          commentId: postResult.commentId,
          subscribed: subscribeResult.success,
          liked: likeResult.success,
        });

        return new Response(
          JSON.stringify({
            success: true,
            jobId: job.id,
            videoId: job.video_id,
            commentId: postResult.commentId,
            subscribed: subscribeResult.success,
            liked: likeResult.success,
            status: "posted",
            todayCount: todayCount + 1,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } else {
        // Failed to post - calculate exponential backoff
        const retryDelays = [15 * 60 * 1000, 60 * 60 * 1000, 4 * 60 * 60 * 1000]; // 15m, 1h, 4h
        const retryDelay = retryDelays[Math.min(job.tries, retryDelays.length - 1)];
        const nextRetry = new Date(Date.now() + retryDelay);

        const { error: updateError } = await supabase
          .from("social_comment_jobs")
          .update({
            text_original: textOriginal,
            text_variant: textVariant,
            text_hash: textHash,
            status: "error",
            last_error: postResult.error,
            tries: job.tries + 1,
            next_retry_at: nextRetry.toISOString(),
          })
          .eq("id", job.id);

        if (updateError) {
          console.error("UPDATE_ERROR_FAILED_POST", {
            jobId: job.id,
            error: updateError,
          });
        }

        await logEvent(
          supabase,
          job.id,
          "POST",
          "error",
          "Failed to post to YouTube",
          {
            error: postResult.error,
          },
        );

        return new Response(
          JSON.stringify({
            success: false,
            error: postResult.error,
            jobId: job.id,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else {
      // No OAuth token - mark as ready for manual posting
      const { error: updateError } = await supabase
        .from("social_comment_jobs")
        .update({
          text_original: textOriginal,
          text_variant: textVariant,
          text_hash: textHash,
          status: "ready",
          last_error: "YouTube OAuth token not configured",
          tries: job.tries + 1,
        })
        .eq("id", job.id);

      if (updateError) {
        console.error("UPDATE_ERROR_NO_TOKEN", {
          jobId: job.id,
          error: updateError,
        });
      }

      await logEvent(
        supabase,
        job.id,
        "READY",
        "warning",
        "Comment ready - OAuth not configured",
      );

      console.log("COMMENT_READY_NO_OAUTH", {
        jobId: job.id,
        videoId: job.video_id,
      });

      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          videoId: job.video_id,
          textPreview: textOriginal.slice(0, 100),
          status: "ready",
          message: "Comment generated but not posted (OAuth not configured)",
          todayCount: todayCount + 1,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("WORKER_ERROR", { error: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
