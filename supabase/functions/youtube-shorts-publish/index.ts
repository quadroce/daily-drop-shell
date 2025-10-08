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
      ? `Create a 45-60 second YouTube Shorts script about: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
Topics: ${topicNames}

Format: Hook (5s) → Body (40s, 3-4 points) → CTA (10s)
Requirements:
- First person, conversational
- 8-12 words per sentence
- Simple language
- Natural pauses
- End with: "Check the link in comments for the full story on DailyDrops"

Return only the script text, one sentence per line.`
      : `Create a 45-60 second YouTube Shorts highlighting: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
Topics: ${topicNames}

Format: Bold opening (5s) → Details (40s, 3 points) → Impact + CTA (10s)
Requirements:
- Energetic tone
- 6-10 words per sentence
- Build excitement
- Natural rhythm
- End with: "Link in comments - dive deeper on DailyDrops"

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
    console.log('Step 2/4: Generating audio with TTS...');
    const gcloudCredsBase64 = Deno.env.get('GCLOUD_TTS_SA_JSON_BASE64');
    if (!gcloudCredsBase64) {
      throw new Error('GCLOUD_TTS_SA_JSON_BASE64 not configured');
    }

    const gcloudCreds = JSON.parse(atob(gcloudCredsBase64));
    
    // Get access token for Google Cloud
    const jwtToken = await createGoogleJWT(gcloudCreds);
    
    const ttsResponse = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: script },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-J', // Male voice
            ssmlGender: 'MALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      throw new Error(`TTS failed: ${error}`);
    }

    const ttsData = await ttsResponse.json();
    const audioBase64 = ttsData.audioContent;
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    console.log('Audio generated, size:', audioBuffer.length, 'bytes');

    // Step 3: Create video with FFmpeg (mock for now - in production use FFmpeg)
    console.log('Step 3/4: Rendering video...');
    
    // For now, we'll create a simple placeholder
    // In production, you would:
    // 1. Use FFmpeg to create video from image + audio
    // 2. Add subtitles, logo overlay, CTA
    // 3. Render at 1080x1920, 30fps, h264 codec
    
    const videoNote = 'Video rendering with FFmpeg not implemented in this demo. In production, use FFmpeg to create 1080x1920 vertical video with audio, subtitles, and branding.';
    
    console.log(videoNote);

    // Step 4: Upload to YouTube
    console.log('Step 4/4: Uploading to YouTube...');
    
    // Get YouTube access token
    const { data: cache } = await supabase
      .from('youtube_oauth_cache')
      .select('access_token, expires_at')
      .eq('id', 1)
      .single();

    if (!cache || !cache.access_token) {
      throw new Error('No YouTube access token available');
    }

    // Check if token is expired
    const expiresAt = new Date(cache.expires_at);
    if (expiresAt <= new Date()) {
      throw new Error('YouTube access token expired');
    }

    // For demo purposes, we'll simulate the upload
    // In production, you would upload the actual video file
    const mockVideoId = 'DEMO_' + crypto.randomUUID().substring(0, 11);
    
    console.log('Mock video upload completed. VideoId:', mockVideoId);
    console.log('In production, upload real video file to YouTube API');

    // Log success event
    await supabase.from('short_job_events').insert({
      stage: 'publish',
      ok: true,
      meta: {
        action: 'publish_shorts',
        platform: 'youtube',
        drop_id: dropId,
        video_id: mockVideoId,
        style,
        quota_cost: 1600,
        note: 'Demo mode - no actual video uploaded'
      }
    });

    const result = {
      success: true,
      mode: 'demo',
      platform: 'youtube',
      videoId: mockVideoId,
      videoUrl: `https://youtube.com/shorts/${mockVideoId}`,
      script: {
        text: script,
        words: script.split(/\s+/).length,
      },
      metadata,
      quotaCost: 1600,
      note: 'Demo mode: Script and audio generated, video rendering and upload not implemented. In production, this would upload a real video to YouTube.',
      nextSteps: [
        'Implement FFmpeg video rendering',
        'Integrate Google Cloud TTS',
        'Complete YouTube upload API integration',
        'Add automatic video deletion after testing'
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
      stage: 'publish',
      ok: false,
      meta: {
        action: 'publish_shorts',
        platform: 'youtube',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return new Response(JSON.stringify({ 
      success: false,
      error: 'publish_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to create Google Cloud JWT
async function createGoogleJWT(credentials: any): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign with private key (simplified - in production use proper crypto)
  const signature = 'MOCK_SIGNATURE'; // In production, use proper RS256 signing

  return `${unsignedToken}.${signature}`;
}
