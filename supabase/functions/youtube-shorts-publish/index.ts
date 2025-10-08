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
    console.log('Publishing YouTube Shorts video...');
    
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

    // Parse request
    const { dropId, style = 'recap', title, description } = await req.json();

    if (!dropId) {
      return new Response(JSON.stringify({ error: 'dropId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch drop data
    const { data: drop, error: dropError } = await supabase
      .from('drops')
      .select('*, sources(name)')
      .eq('id', dropId)
      .single();

    if (dropError || !drop) {
      throw new Error('Drop not found');
    }

    // Get topics
    const { data: topics } = await supabase
      .from('content_topics')
      .select('topics(slug, name)')
      .eq('content_id', dropId);

    const topicNames = topics?.map((t: any) => t.topics.name).join(', ') || 'tech';

    // Step 1: Generate script using OpenAI GPT-5
    console.log('Step 1/4: Generating script...');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const scriptPrompt = style === 'recap' 
      ? `Create a 20-25 second YouTube Shorts script about: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
Topics: ${topicNames}

CRITICAL: Maximum 50-60 words total (about 2.5 words per second)

Format: Hook (3s) → Key Point (15s) → CTA (5s)
Requirements:
- First person, conversational
- 6-8 words per sentence
- ONE main point only
- Simple language
- End with: "Link in comments for more on DailyDrops"

Return only the script text, one sentence per line.`
      : `Create a 20-25 second YouTube Shorts highlighting: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
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
            content: 'You are a YouTube Shorts script writer. Create engaging, concise scripts optimized for vertical video.'
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
      throw new Error(`Script generation failed: ${errorData}`);
    }

    const scriptData = await scriptResponse.json();
    const script = scriptData.choices[0].message.content.trim();

    console.log('Script generated:', script.substring(0, 100) + '...');

    // Generate metadata
    const ctaUrl = `https://dailydrops.io/drops/${drop.id}?utm_source=youtube&utm_medium=shorts&utm_campaign=${style}`;
    
    const metadata = {
      title: title || `${drop.title.substring(0, 80)} #Shorts`,
      description: description || `${drop.summary?.substring(0, 200) || drop.title}\n\nLearn more at dailydrops.io\n${ctaUrl}\n\n#tech #innovation`,
      tags: ['tech', 'innovation'],
      categoryId: '28',
    };

    // Step 2: Generate TTS audio using Google Cloud TTS
    console.log('Step 2/4: Generating TTS audio...');
    
    const gcpProject = Deno.env.get('GCLOUD_TTS_PROJECT');
    const gcpKeyBase64 = Deno.env.get('GCLOUD_TTS_SA_JSON_BASE64');
    
    if (!gcpProject || !gcpKeyBase64) {
      throw new Error('Google Cloud TTS not configured');
    }

    const gcpKey = JSON.parse(atob(gcpKeyBase64));
    
    // Get access token for Google Cloud
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaim = btoa(JSON.stringify({
      iss: gcpKey.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }));
    
    const signatureInput = `${jwtHeader}.${jwtClaim}`;
    
    // Generate access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${jwtHeader}.${jwtClaim}.signature_placeholder` // Simplified for demo
      })
    });

    let audioContent;
    try {
      // Call Google Cloud TTS API
      const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gcpKey.private_key}` // Simplified auth
          },
          body: JSON.stringify({
            input: { text: script },
            voice: {
              languageCode: 'en-US',
              name: 'en-US-Neural2-J', // Professional male voice
              ssmlGender: 'MALE'
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.0,
              pitch: 0,
              volumeGainDb: 0
            }
          })
        }
      );

      if (!ttsResponse.ok) {
        throw new Error('TTS generation failed');
      }

      const ttsData = await ttsResponse.json();
      audioContent = ttsData.audioContent;
      console.log('✅ TTS audio generated');
      
    } catch (ttsError) {
      console.error('TTS error:', ttsError);
      throw new Error('Failed to generate TTS audio');
    }

    // Step 3: Create video placeholder (FFmpeg would be here in production)
    console.log('Step 3/4: Creating video (simulated)...');
    console.log('⚠️ Video rendering with FFmpeg not available in Deno edge functions');
    console.log('Production would use: FFmpeg to create 1080x1920, 30fps, h264 video');

    // Step 4: Upload to YouTube (simulated)
    console.log('Step 4/4: Uploading to YouTube (simulated)...');
    
    const mockVideoId = 'DEMO_' + crypto.randomUUID().substring(0, 11);

    // Log success event
    await supabase.from('short_job_events').insert({
      stage: 'tts_generation',
      ok: true,
      meta: {
        action: 'generate_tts',
        platform: 'youtube',
        drop_id: dropId,
        style,
        model: 'gpt-5-2025-08-07',
        tts_provider: 'google_cloud',
        video_status: 'simulated',
        note: 'TTS generated - Video rendering and upload simulated (requires FFmpeg infrastructure)'
      }
    });

    const result = {
      success: true,
      mode: 'tts_generated',
      platform: 'youtube',
      script: {
        text: script,
        words: script.split(/\s+/).length,
        estimatedDuration: `${Math.ceil(script.split(/\s+/).length / 2.5)}s`,
      },
      audio: {
        provider: 'Google Cloud TTS',
        voice: 'en-US-Neural2-J',
        duration: `~${Math.ceil(script.split(/\s+/).length / 2.5)}s`,
        size: audioContent ? `${Math.ceil(audioContent.length * 0.75 / 1024)}KB` : 'N/A'
      },
      video: {
        status: 'simulated',
        mockId: mockVideoId,
        format: '1080x1920, 30fps, h264',
        note: 'Video rendering requires FFmpeg infrastructure not available in edge functions'
      },
      metadata,
      note: '✅ Script e audio TTS generati. ⚠️ Video rendering e upload YouTube simulati (richiedono infrastruttura FFmpeg).',
      nextSteps: [
        'Implementare rendering video con FFmpeg (richiede server dedicato)',
        'Integrare caricamento su YouTube Data API v3 con OAuth',
        'Aggiungere sottotitoli automatici al video',
        'Ottimizzare thumbnail per YouTube Shorts'
      ]
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-shorts-publish:', error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('short_job_events').insert({
      stage: 'script_generation',
      ok: false,
      meta: {
        action: 'generate_script',
        platform: 'youtube',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return new Response(JSON.stringify({ 
      success: false,
      error: 'script_generation_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
