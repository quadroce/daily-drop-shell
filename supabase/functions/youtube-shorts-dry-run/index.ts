import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting YouTube Shorts dry-run...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request - dropId is optional, we'll use a test drop if not provided
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      // No body or empty body is fine, we'll use test data
      console.log('No request body, using test data');
    }
    
    const { dropId, style = 'recap' } = requestBody;

    // If no dropId provided, fetch a recent drop for testing
    let testDropId = dropId;
    if (!testDropId) {
      console.log('No dropId provided, fetching a recent drop for testing...');
      const { data: recentDrop } = await supabase
        .from('drops')
        .select('id')
        .eq('tag_done', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .single();
      
      if (recentDrop) {
        testDropId = recentDrop.id;
        console.log(`Using test dropId: ${testDropId}`);
      } else {
        return new Response(JSON.stringify({ error: 'No drops available for testing' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Fetch drop data
    const { data: drop, error: dropError } = await supabase
      .from('drops')
      .select('*, sources(name)')
      .eq('id', testDropId)
      .single();

    if (dropError || !drop) {
      return new Response(JSON.stringify({ 
        error: 'Drop not found',
        details: dropError?.message 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get topics
    const { data: topics } = await supabase
      .from('content_topics')
      .select('topics(slug, name)')
      .eq('content_id', dropId);

    const topicNames = topics?.map((t: any) => t.topics.name).join(', ') || 'tech';

    console.log('Generating script for drop:', drop.title);

    // Generate script using OpenAI GPT-5
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Script generation prompt based on Appendix A from PRD
    const scriptPrompt = style === 'recap' 
      ? `Create a 45-60 second YouTube Shorts script about: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
Topics: ${topicNames}
Source: ${drop.sources?.name || 'Unknown'}

Format as a Recap style:
- Hook (5s): Attention-grabbing opening question or statement
- Body (40s): 3-4 key points, each 10-12 seconds
- CTA (10s): "Learn more at dailydrops.io" with clear call-to-action

Requirements:
- Write in first person, conversational tone
- Each sentence should be 8-12 words max
- Use simple, clear language
- Include natural pauses
- Total duration: 45-60 seconds when read aloud
- End with: "Check the link in comments for the full story on DailyDrops"

Return only the script text, one sentence per line.`
      : `Create a 45-60 second YouTube Shorts script highlighting: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
Topics: ${topicNames}

Format as a Highlight style:
- Opening (5s): Bold statement about the innovation
- Details (40s): Most impressive aspects, broken into 3 points
- Closing (10s): Impact statement + "More at dailydrops.io"

Requirements:
- Energetic, excited tone
- Short, punchy sentences (6-10 words)
- Build excitement throughout
- Natural speaking rhythm
- 45-60 seconds when read aloud
- End with: "Link in comments - dive deeper on DailyDrops"

Return only the script text, one sentence per line.`;

    const scriptStartTime = Date.now();
    const scriptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube Shorts script writer. Create engaging, concise scripts optimized for vertical video format and short attention spans.'
          },
          {
            role: 'user',
            content: scriptPrompt
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!scriptResponse.ok) {
      const errorData = await scriptResponse.text();
      console.error('OpenAI API error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'script_generation_failed',
        message: errorData
      }), {
        status: scriptResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const scriptData = await scriptResponse.json();
    const script = scriptData.choices[0].message.content.trim();
    const scriptDuration = Date.now() - scriptStartTime;

    console.log('Script generated in', scriptDuration, 'ms');
    console.log('Script preview:', script.substring(0, 100) + '...');

    // Calculate estimated metrics
    const words = script.split(/\s+/).length;
    const estimatedDuration = Math.round((words / 2.5) * 1000); // ~2.5 words per second
    const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    // Mock TTS generation (in production, use Google Cloud TTS)
    const mockAudioUrl = 'https://example.com/mock-audio.mp3';
    const audioGenTime = 2000; // Mock 2 seconds

    // Mock video rendering specs
    const videoSpecs = {
      resolution: '1080x1920',
      fps: 30,
      duration: estimatedDuration,
      format: 'mp4',
      codec: 'h264',
      bitrate: '8M',
      size_estimate_mb: Math.round((estimatedDuration / 1000) * 2.5), // ~2.5MB per second
    };

    // Create CTA with UTM parameters
    const ctaText = 'Learn more at dailydrops.io';
    const utmUrl = `https://dailydrops.io/drops/${drop.id}?utm_source=youtube&utm_medium=shorts&utm_campaign=recap`;

    // Log event
    await supabase.from('short_job_events').insert({
      stage: 'dry_run',
      ok: true,
      meta: {
        action: 'generate_script',
        drop_id: dropId,
        style,
        script_duration_ms: scriptDuration,
        estimated_video_duration_ms: estimatedDuration,
        word_count: words,
        sentence_count: sentences,
        quota_cost: 0, // dry-run doesn't use YouTube quota
      }
    });

    const result = {
      success: true,
      mode: 'dry-run',
      drop: {
        id: drop.id,
        title: drop.title,
        url: drop.url,
        topics: topicNames
      },
      script: {
        text: script,
        style,
        words,
        sentences,
        estimated_duration_seconds: Math.round(estimatedDuration / 1000),
        generation_time_ms: scriptDuration
      },
      audio: {
        url: mockAudioUrl,
        format: 'mp3',
        duration_ms: estimatedDuration,
        generation_time_ms: audioGenTime,
        note: 'Mock audio - not generated in dry-run mode'
      },
      video: {
        specs: videoSpecs,
        thumbnail: drop.image_url,
        note: 'Video not rendered in dry-run mode'
      },
      metadata: {
        title: `${drop.title.substring(0, 80)} #Shorts`,
        description: `${drop.summary?.substring(0, 200) || drop.title}\n\n${ctaText}\n${utmUrl}\n\n#tech #innovation #${topicNames.split(',')[0].trim().replace(/\s+/g, '')}`,
        tags: ['tech', 'innovation', topicNames.split(',')[0].trim()],
        category: 28, // Science & Technology
        privacy: 'public'
      },
      cta: {
        text: ctaText,
        url: utmUrl
      },
      estimated_quota_cost: 1600, // YouTube upload cost
      next_steps: [
        'Review script and metadata',
        'Run youtube-shorts-publish to generate and upload video',
        'Monitor quota usage'
      ]
    };

    console.log('Dry-run completed successfully');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-shorts-dry-run:', error);
    
    // Log error event
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('short_job_events').insert({
      stage: 'dry_run',
      ok: false,
      meta: {
        action: 'generate_script',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return new Response(JSON.stringify({ 
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
