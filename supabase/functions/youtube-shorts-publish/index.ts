import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log("Publishing YouTube Shorts video...");

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

      // Fetch recent content (last 48h, limit 10)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: items } = await supabase
        .from('content_topics')
        .select('drops(id, title, summary, published_at)')
        .eq('topic_id', topic.id)
        .gte('drops.published_at', twoDaysAgo)
        .order('drops.published_at', { ascending: false })
        .limit(10);

      recentItems = items?.map((i: any) => i.drops).filter(Boolean) || [];
      console.log(`Found ${recentItems.length} recent items for topic ${topic.label}`);
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
        'No major headlines in the last 24 hours.',
        'Explore curated picks and evergreen resources.',
        'Discover trending sources and fresh perspectives.',
        `See more on DailyDrops — https://dailydrops.cloud/topics/${topicSlug}`
      ];

      if (itemsJson.length === 0) {
        scriptLines = fallbackScript;
      } else {
        const scriptPromptText = `Write exactly 5 lines for a short video about recent content in "${topicData.label}". 

Recent items (last 48h):
${JSON.stringify(itemsJson, null, 2)}

Format (exactly 5 lines, separated by \\n):
Line 1: "Today in {TopicName}."
Lines 2-4: Three highlights, each ≤10 words, neutral/informative
Line 5: "See more on DailyDrops — https://dailydrops.cloud/topics/${topicSlug}"

Total max ~60 words. Return only the 5 lines, no quotes, no markdown.`;

        const scriptResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-5-2025-08-07",
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
              max_completion_tokens: 300,
            }),
          },
        );

        if (!scriptResponse.ok) {
          console.warn('Script generation failed, using fallback');
          scriptLines = fallbackScript;
        } else {
          const scriptData = await scriptResponse.json();
          const rawScript = scriptData.choices[0].message.content.trim();
          scriptLines = rawScript.split('\n').filter((l: string) => l.trim()).slice(0, 5);
          if (scriptLines.length < 5) scriptLines = fallbackScript;
        }
      }
      
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
            model: "gpt-5-2025-08-07",
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
            max_completion_tokens: 1000,
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
        !scriptData.choices[0].message || !scriptData.choices[0].message.content
      ) {
        console.error("Invalid OpenAI response structure:", scriptData);
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
        ? `Quick highlights from ${topicData.label}\n\nLearn more at ${ctaUrl}\n\n#tech #${topicSlug}`
        : (description || `${drop.summary?.substring(0, 200) || drop.title}\n\nLearn more at ${ctaUrl}\n\n#tech #innovation`),
      tags: isTopicDigest ? [topicSlug, "tech", "news"] : ["tech", "innovation"],
      categoryId: "28",
    };

    console.log("✅ Script generation completed successfully");
    console.log(
      "⚠️ TTS, video rendering, and YouTube upload not yet implemented for both Drop and Topic Digest modes",
    );

    // TODO: Implement these production steps:
    // Step 2: Generate TTS audio OR use text overlays (for Topic Digest)
    // Step 3: Render video with Shotstack (9:16, 30fps) - similar to LinkedIn implementation
    // Step 4: Upload to YouTube using YouTube Data API v3

    // Log success event
    await supabase.from("short_job_events").insert({
      stage: "script_generation",
      ok: true,
      meta: {
        action: "generate_script",
        platform: "youtube",
        mode: isTopicDigest ? "topic_digest" : "drop",
        ...(isTopicDigest ? {
          topic_slug: topicSlug,
          topic_id: topicData.id,
          items_count: recentItems.length,
          music_url: musicUrl,
          logo_url: logoUrl
        } : {
          drop_id: dropId
        }),
        style,
        model: "gpt-5-2025-08-07",
        note:
          "Script generated successfully - TTS/rendering/upload not yet implemented",
      },
    });

    const result: any = {
      success: true,
      mode: isTopicDigest ? "topic_digest_script" : "script_only",
      platform: "youtube",
      script: {
        text: script,
        words: script.split(/\s+/).length
      },
      metadata,
      note:
        "✅ Script generato con successo. ⚠️ Rendering video e caricamento su YouTube non ancora implementati.",
      nextSteps: [
        "Implementare rendering video con Shotstack (1080x1920, 30fps, 9:16)",
        "Integrare caricamento su YouTube Data API v3",
        "Configurare autenticazione OAuth per YouTube",
      ],
    };

    if (isTopicDigest) {
      result.topic = {
        slug: topicSlug,
        name: topicData.label,
        id: topicData.id
      };
      result.script.lines = scriptLines;
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
      stage: "script_generation",
      ok: false,
      meta: {
        action: "generate_script",
        platform: "youtube",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "script_generation_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
