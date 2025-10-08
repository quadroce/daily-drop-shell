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

    // Parse request
    const { dropId, style = "recap", title, description } = await req.json();

    if (!dropId) {
      return new Response(JSON.stringify({ error: "dropId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch drop data
    const { data: drop, error: dropError } = await supabase
      .from("drops")
      .select("*, sources(name)")
      .eq("id", dropId)
      .single();

    if (dropError || !drop) {
      throw new Error("Drop not found");
    }

    // Get topics
    const { data: topics } = await supabase
      .from("content_topics")
      .select("topics(slug, name)")
      .eq("content_id", dropId);

    const topicNames = topics?.map((t: any) => t.topics.name).join(", ") ||
      "tech";

    // Step 1: Generate script using OpenAI GPT-5
    console.log("Step 1/4: Generating script...");

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const scriptPrompt = style === "recap"
      ? `Create a 45-60 second YouTube Shorts script about: "${drop.title}"

Summary: ${drop.summary || "No summary available"}
Topics: ${topicNames}

Format: Hook (5s) → Body (40s, 3-4 points) → CTA (10s)
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

    const script = scriptData.choices[0].message.content.trim();

    console.log("Script generated:", script.substring(0, 100) + "...");

    // Generate metadata
    const ctaUrl =
      `https://dailydrops.io/drops/${drop.id}?utm_source=youtube&utm_medium=shorts&utm_campaign=${style}`;

    const metadata = {
      title: title || `${drop.title.substring(0, 80)} #Shorts`,
      description: description ||
        `${
          drop.summary?.substring(0, 200) || drop.title
        }\n\nLearn more at dailydrops.io\n${ctaUrl}\n\n#tech #innovation`,
      tags: ["tech", "innovation"],
      categoryId: "28",
    };

    console.log("✅ Script generation completed successfully");
    console.log(
      "⚠️ TTS, video rendering, and YouTube upload not yet implemented",
    );

    // TODO: Implement these production steps:
    // Step 2: Generate TTS audio using Google Cloud TTS or ElevenLabs
    // Step 3: Create video with FFmpeg (1080x1920, 30fps, h264 codec)
    // Step 4: Upload to YouTube using YouTube Data API v3

    // Log success event
    await supabase.from("short_job_events").insert({
      stage: "script_generation",
      ok: true,
      meta: {
        action: "generate_script",
        platform: "youtube",
        drop_id: dropId,
        style,
        model: "gpt-5-2025-08-07",
        note:
          "Script generated successfully - TTS and video rendering not yet implemented",
      },
    });

    const result = {
      success: true,
      mode: "script_only",
      platform: "youtube",
      script: {
        text: script,
        words: script.split(/\s+/).length,
        estimatedDuration: `${audioDuration}s`,
      },
      audio: {
        provider: "Google Cloud TTS",
        voice: "en-US-Neural2-J",
        duration: `${audioDuration}s`,
        size: audioBase64
          ? `${Math.ceil(audioBase64.length * 0.75 / 1024)}KB`
          : "N/A",
      },
      video: {
        status: "published",
        renderId,
        format: "1080x1920 (9:16), 30fps, h264",
        size: `${Math.ceil(videoBlob.byteLength / 1024)}KB`,
        shotstackUrl: videoUrl,
      },
      metadata,
      note:
        "✅ Script generato con successo usando GPT-5. ⚠️ TTS, rendering video e caricamento su YouTube non ancora implementati.",
      nextSteps: [
        "Implementare TTS (Google Cloud TTS o ElevenLabs)",
        "Implementare rendering video con FFmpeg (1080x1920, 30fps)",
        "Integrare caricamento su YouTube Data API v3",
        "Configurare autenticazione OAuth per YouTube",
      ],
    };

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
