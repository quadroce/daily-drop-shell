import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildYouTubeShortsPayload, submitShotstackRender, pollShotstackRender } from '../_shared/renderer/shotstack.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Publishing YouTube Shorts video with TTS audio...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request - support both drop-based and topic-based digest
    const { dropId, topicSlug, style = "recap", title, description } = await req.json();

    // Determine mode
    const isTopicDigest = !!topicSlug;

    if (!dropId && !topicSlug) {
      return new Response(JSON.stringify({ error: "Either dropId or topicSlug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let drop: any = null;
    let topicData: any = null;
    let topicNames = "tech";
    let recentItems: any[] = [];
    let scriptLines: string[] = [];

    if (isTopicDigest) {
      // Topic Digest Mode
      console.log('Topic Digest Mode: fetching topic data...');
      
      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .select('id, slug, label')
        .eq('slug', topicSlug)
        .single();

      if (topicError || !topic) {
        throw new Error(`Topic not found: ${topicSlug}`);
      }

      topicData = topic;
      topicNames = topic.label;

      // Get all topics to find children
      const { data: allTopics } = await supabase
        .from('topics')
        .select('id, slug, level, parent_id')
        .eq('is_active', true);

      // Get relevant topic IDs (current topic + children if L1 or L2)
      let relevantTopicIds = [topic.id];
      
      if (topic.level <= 2 && allTopics) {
        const children = allTopics.filter(t => t.parent_id === topic.id);
        relevantTopicIds.push(...children.map(c => c.id));
        
        // For L1 topics, also include grandchildren
        if (topic.level === 1) {
          const grandchildren = allTopics.filter(t => children.some(c => c.id === t.parent_id));
          relevantTopicIds.push(...grandchildren.map(gc => gc.id));
        }
      }

      console.log(`Topic IDs to search: ${relevantTopicIds.join(', ')}`);

      // Fetch recent content (last 30 days to have more articles, limit 15)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: drops, error: itemsError } = await supabase
        .from('drops')
        .select('id, title, summary, published_at, content_topics!inner(topic_id)')
        .in('content_topics.topic_id', relevantTopicIds)
        .gte('published_at', thirtyDaysAgo)
        .eq('tag_done', true)
        .order('published_at', { ascending: false })
        .limit(15);

      recentItems = drops || [];
      console.log(`Found ${recentItems.length} recent items for topic ${topic.label} (including children)`);
      console.log('Recent items:', JSON.stringify(recentItems.map(i => ({ title: i.title, date: i.published_at })), null, 2));
    } else {
      // Original Drop Mode
      const { data: fetchedDrop, error: dropError } = await supabase
        .from("drops")
        .select("*, sources(name)")
        .eq("id", dropId)
        .single();

      if (dropError || !fetchedDrop) {
        throw new Error("Drop not found");
      }

      drop = fetchedDrop;

      // Get topics
      const { data: topics } = await supabase
        .from("content_topics")
        .select("topics(slug, name)")
        .eq("content_id", dropId);

      topicNames = topics?.map((t: any) => t.topics.name).join(", ") || "tech";
    }

    // Get logo URL from Storage
    let logoUrl: string | null = null;
    try {
      const { data: logoData } = supabase.storage
        .from('assets')
        .getPublicUrl('dailydrops-logo-square.png');
      logoUrl = logoData?.publicUrl || null;
    } catch (err) {
      console.warn('Failed to get logo URL:', err);
    }

    // Get random music track from Storage
    let musicUrl: string | null = null;
    try {
      const musicFiles = ['music1.mp3', 'music2.mp3', 'music3.mp3', 'music4.mp3', 'music5.mp3'];
      const randomMusic = musicFiles[Math.floor(Math.random() * musicFiles.length)];
      const { data: musicData } = supabase.storage
        .from('music')
        .getPublicUrl(randomMusic);
      musicUrl = musicData?.publicUrl || null;
    } catch (err) {
      console.warn('Failed to get music URL, continuing without soundtrack:', err);
    }

    // Step 1: Generate script using OpenAI GPT-5
    console.log("Step 1/4: Generating script...");

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    let scriptPrompt: string;

    if (isTopicDigest) {
      // Topic Digest Mode
      const itemsJson = recentItems.length > 0
        ? recentItems.slice(0, 10).map(item => ({
            title: item.title,
            summary: item.summary?.substring(0, 100) || ''
          }))
        : [];

      const fallbackScript = [
        `Today in ${topicData.label}.`,
        'Explore curated picks and resources.',
        `See more on DailyDrops — https://dailydrops.cloud/topics/${topicSlug}`
      ];

      console.log(`Items for script generation: ${itemsJson.length} items found`);
      
      if (itemsJson.length === 0) {
        console.log('Using fallback script - no items found');
        scriptLines = fallbackScript;
      } else {
        const scriptPromptText = `Write exactly 3 lines for a 15-second short video about recent content in "${topicData.label}". 

Recent items (last 48h):
${JSON.stringify(itemsJson, null, 2)}

Format (exactly 3 lines, separated by \\n):
Line 1: "Today in {TopicName}." (≤6 words)
Line 2: One key highlight, ≤10 words, neutral/informative
Line 3: "See more on DailyDrops — https://dailydrops.cloud/topics/${topicSlug}"

Total max ~35 words. Return only the 3 lines, no quotes, no markdown.`;

        const scriptResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You write concise, scannable on-screen captions for short social videos. No emojis."
                },
                {
                  role: "user",
                  content: scriptPromptText
                }
              ],
              max_tokens: 300,
              temperature: 0.7,
            }),
          },
        );

        if (!scriptResponse.ok) {
          console.warn('Script generation failed, using fallback');
          scriptLines = fallbackScript;
        } else {
          const scriptData = await scriptResponse.json();
          const rawScript = scriptData.choices[0].message.content.trim();
          console.log('Generated script from AI:', rawScript);
          scriptLines = rawScript.split('\n').filter((l: string) => l.trim()).slice(0, 3);
          if (scriptLines.length < 3) {
            console.log('Script too short, using fallback');
            scriptLines = fallbackScript;
          }
        }
      }
      
      console.log('Final script lines:', scriptLines);
      
      scriptPrompt = ''; // Not used in Topic Digest mode
    } else {
      // Original Drop Mode
      scriptPrompt = style === "recap"
      ? `Create a 30 second YouTube Shorts script about: "${drop.title}"

Summary: ${drop.summary || "No summary available"}
Topics: ${topicNames}

Format: Hook (5s) → Body (15s, 3-4 points) → CTA (10s)
Requirements:
- First person, conversational
- 6-8 words per sentence
- ONE main point only
- Simple language
- End with: "Link in comments for more on DailyDrops"

Return only the script text, one sentence per line.`
      : `Create a 45-60 second YouTube Shorts highlighting: "${drop.title}"

Summary: ${drop.summary || "No summary available"}
Topics: ${topicNames}

CRITICAL: Maximum 50-60 words total (about 2.5 words per second)

Format: Bold opening (3s) → Main insight (15s) → Impact + CTA (5s)
Requirements:
- Energetic tone
- 5-7 words per sentence
- ONE key takeaway
- Build excitement
- End with: "Check comments for the full story"

Return only the script text, one sentence per line.`;
    }

    let script: string = '';

    if (!isTopicDigest) {
      // Original Drop Mode - generate script via OpenAI
      const scriptResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a YouTube Shorts script writer. Create engaging, concise scripts optimized for vertical video.",
              },
              {
                role: "user",
                content: scriptPrompt,
              },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        },
      );

      if (!scriptResponse.ok) {
        const errorData = await scriptResponse.text();
        console.error("OpenAI API error:", errorData);
        throw new Error(`Script generation failed: ${errorData}`);
      }

      const scriptData = await scriptResponse.json();
      console.log("OpenAI response:", JSON.stringify(scriptData, null, 2));

      if (!scriptData.choices || scriptData.choices.length === 0) {
        throw new Error("OpenAI returned no choices");
      }

      if (
        !scriptData.choices[0].message || 
        !scriptData.choices[0].message.content ||
        scriptData.choices[0].message.content.trim() === ""
      ) {
        console.error("Invalid OpenAI response structure:", scriptData);
        const finishReason = scriptData.choices?.[0]?.finish_reason;
        if (finishReason === "length") {
          throw new Error("OpenAI response truncated: max_completion_tokens too low or model used all tokens for reasoning");
        }
        throw new Error("OpenAI returned invalid response structure");
      }

      script = scriptData.choices[0].message.content.trim();
    } else {
      // Topic Digest Mode - script already generated in scriptLines
      script = scriptLines.join('\n');
    }

    console.log("Script generated:", script.substring(0, 100) + "...");

    // Generate metadata
    const ctaUrl = isTopicDigest
      ? `https://dailydrops.cloud/topics/${topicSlug}?utm_source=youtube&utm_medium=shorts&utm_campaign=digest`
      : `https://dailydrops.cloud?utm_source=youtube&utm_medium=shorts&utm_campaign=${style}`;

    const metadata = {
      title: isTopicDigest
        ? `Today in ${topicData.label} #Shorts`
        : (title || `${drop.title.substring(0, 80)} #Shorts`),
      description: isTopicDigest
        ? `Quick highlights from ${topicData.label}\n\n${script}\n\nLearn more at ${ctaUrl}\n\n#tech #${topicSlug}`
        : (description || `${drop.summary?.substring(0, 200) || drop.title}\n\n${script}\n\nLearn more at ${ctaUrl}\n\n#tech #innovation`),
      tags: isTopicDigest ? [topicSlug, "tech", "news"] : ["tech", "innovation"],
      categoryId: "28",
    };

    console.log("✅ Script generation completed successfully");

    // Step 2: Generate TTS audio from script
    console.log("Step 2/6: Generating TTS audio...");

    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: script,
        voice: 'nova', // Female voice, clear and professional
        response_format: 'mp3',
        speed: 1.0
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("OpenAI TTS error:", errorText);
      throw new Error(`TTS generation failed: ${errorText}`);
    }

    // Save TTS audio to Supabase Storage
    const ttsArrayBuffer = await ttsResponse.arrayBuffer();
    const ttsFileName = `tts-${Date.now()}.mp3`;
    
    const { data: ttsUpload, error: ttsUploadError } = await supabase.storage
      .from('music')
      .upload(ttsFileName, ttsArrayBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (ttsUploadError) {
      console.error("TTS upload error:", ttsUploadError);
      throw new Error(`Failed to save TTS audio: ${ttsUploadError.message}`);
    }

    const { data: ttsUrlData } = supabase.storage
      .from('music')
      .getPublicUrl(ttsFileName);

    const ttsAudioUrl = ttsUrlData.publicUrl;
    console.log(`✅ TTS audio generated: ${ttsAudioUrl}`);

    // Step 3: Render video with Shotstack (9:16, 30fps)
    console.log("Step 3/6: Rendering video with Shotstack...");

    const shotstackApiKey = Deno.env.get("SHOTSTACK_API_KEY");
    if (!shotstackApiKey) {
      throw new Error("SHOTSTACK_API_KEY not configured");
    }

    // Prepare script lines and create video segments with timing
    const lines = isTopicDigest ? scriptLines : script.split('\n').filter(l => l.trim());
    
    // Create segments with timing for 20-second video (2s opening + ~15s content + 3s CTA)
    let currentTime = 2.0; // Start after 2s logo opening
    const segments = lines.map(line => {
      const duration = Math.max(4, Math.min(5, line.length / 3)); // 4-5s based on length
      const segment = {
        text: line,
        start: currentTime,
        end: currentTime + duration
      };
      currentTime += duration;
      return segment;
    });
    
    // Use TTS audio as primary audio
    const audioUrl = ttsAudioUrl;
    
    // Use shared renderer module (new API with segments)
    const timelinePayload = buildYouTubeShortsPayload(
      segments,
      audioUrl, // TTS voice
      topicSlug,
      style || 'recap',
      musicUrl // Background music (optional)
    );

    // Submit render job
    const renderId = await submitShotstackRender(timelinePayload, shotstackApiKey);
    console.log(`Render started: ${renderId}`);

    // Step 4: Poll for render completion (up to 90s)
    console.log("Step 4/6: Waiting for render completion...");
    const { videoUrl } = await pollShotstackRender(renderId, shotstackApiKey, 30, 3000);
    console.log(`✅ Render completed: ${videoUrl}`);

    // Step 5: Download video from Shotstack
    console.log("Step 5/6: Downloading video from Shotstack...");

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoBuffer = await videoBlob.arrayBuffer();
    console.log(`Video downloaded: ${videoBuffer.byteLength} bytes`);

    // Step 6: Get YouTube OAuth token
    console.log("Step 6/6: Getting YouTube OAuth token...");

    const { data: tokenData } = await supabase
      .from("youtube_oauth_cache")
      .select("access_token, expires_at")
      .eq("id", 1)
      .single();

    if (!tokenData || !tokenData.access_token) {
      throw new Error("YouTube OAuth token not found - please authenticate first");
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error("YouTube OAuth token expired - please re-authenticate");
    }

    const youtubeToken = tokenData.access_token;

    // Step 7: Upload to YouTube
    console.log("Step 7/7: Uploading to YouTube...");

    // Create video metadata
    const videoMetadata = {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false
      }
    };

    // Upload video using resumable upload
    const uploadUrl = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
    
    const initResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${youtubeToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": videoBuffer.byteLength.toString()
      },
      body: JSON.stringify(videoMetadata)
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error("YouTube upload init error:", errorText);
      throw new Error(`YouTube upload init failed: ${errorText}`);
    }

    const uploadSessionUrl = initResponse.headers.get("Location");
    if (!uploadSessionUrl) {
      throw new Error("No upload session URL returned from YouTube");
    }

    // Upload the video binary
    const uploadResponse = await fetch(uploadSessionUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4"
      },
      body: videoBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("YouTube video upload error:", errorText);
      throw new Error(`YouTube video upload failed: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const videoId = uploadResult.id;
    const videoPublicUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`✅ Video uploaded successfully: ${videoPublicUrl}`)

    // Log success event
    await supabase.from("short_job_events").insert({
      stage: "upload_done",
      ok: true,
      meta: {
        action: "publish_youtube_short",
        platform: "youtube",
        mode: isTopicDigest ? "topic_digest" : "drop",
        ...(isTopicDigest ? {
          topic_slug: topicSlug,
          topic_id: topicData.id,
          items_count: recentItems.length,
          tts_audio_url: ttsAudioUrl,
          background_music_url: musicUrl,
          logo_url: logoUrl
        } : {
          drop_id: dropId
        }),
        style,
        model: "gpt-4o-mini",
        render_id: renderId,
        video_url: videoUrl,
        youtube_video_id: videoId,
        youtube_url: videoPublicUrl
      },
    });

    const result: any = {
      success: true,
      mode: isTopicDigest ? "topic_digest" : "drop",
      platform: "youtube",
      script: {
        text: script,
        lines: isTopicDigest ? scriptLines : script.split('\n').filter(l => l.trim()),
        words: script.split(/\s+/).length
      },
      shotstack: {
        renderId,
        videoUrl,
        duration_s: currentTime
      },
      youtube: {
        videoId,
        url: videoPublicUrl
      },
      tts: {
        audioUrl: ttsAudioUrl
      },
      metadata
    };

    if (isTopicDigest) {
      result.topic = {
        slug: topicSlug,
        name: topicData.label,
        id: topicData.id
      };
      if (musicUrl) result.music = { url: musicUrl };
      if (logoUrl) result.logo = { url: logoUrl };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in youtube-shorts-publish:", error);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("short_job_events").insert({
      stage: "publish_failed",
      ok: false,
      meta: {
        action: "publish_youtube_short",
        platform: "youtube",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "publish_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
