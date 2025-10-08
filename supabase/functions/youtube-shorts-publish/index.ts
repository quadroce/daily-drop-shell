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
        max_completion_tokens: 4000, // Increased for reasoning + output
      }),
    });

    if (!scriptResponse.ok) {
      const errorData = await scriptResponse.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`Script generation failed: ${errorData}`);
    }

    const scriptData = await scriptResponse.json();
    console.log('OpenAI response:', JSON.stringify(scriptData, null, 2));
    
    if (!scriptData.choices || scriptData.choices.length === 0) {
      throw new Error('OpenAI returned no choices');
    }
    
    if (!scriptData.choices[0].message || !scriptData.choices[0].message.content) {
      console.error('Invalid OpenAI response structure:', scriptData);
      throw new Error('OpenAI returned invalid response structure');
    }
    
    const script = scriptData.choices[0].message.content.trim();

    if (!script || script.length === 0) {
      console.error('Script is empty after OpenAI generation');
      throw new Error('OpenAI returned empty script');
    }

    console.log('Script generated successfully (length:', script.length, ')');
    console.log('Script preview:', script.substring(0, 200));

    // Generate metadata with correct drop link
    const dropUrl = `https://dailydrops.cloud/drops/${drop.id}`;
    
    const metadata = {
      title: title || `DailyDrops: ${drop.title.substring(0, 70)}`,
      description: description || `${drop.summary?.substring(0, 200) || drop.title}\n\n🔗 ${dropUrl}\n\n#tech #innovation #dailydrops`,
      tags: ['tech', 'innovation', 'dailydrops'],
      categoryId: '28',
    };

    // Step 2: Generate TTS audio using Google Cloud TTS
    console.log('Step 2/5: Generating TTS audio...');
    
    const gcpProject = Deno.env.get('GCLOUD_TTS_PROJECT');
    const gcpKeyBase64 = Deno.env.get('GCLOUD_TTS_SA_JSON_BASE64');
    
    if (!gcpProject || !gcpKeyBase64) {
      throw new Error('Google Cloud TTS not configured');
    }

    const gcpKey = JSON.parse(atob(gcpKeyBase64));
    
    // Create JWT for Google Cloud authentication
    const { create, getNumericDate } = await import('https://deno.land/x/djwt@v3.0.2/mod.ts');
    const { importPKCS8 } = await import('https://deno.land/x/jose@v5.9.6/key/import.ts');
    
    const privateKey = await importPKCS8(gcpKey.private_key, 'RS256');
    
    const jwt = await create(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: gcpKey.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        exp: getNumericDate(3600),
        iat: getNumericDate(0),
      },
      privateKey
    );

    // Exchange JWT for access token
    const ttsTokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!ttsTokenResponse.ok) {
      const errorText = await ttsTokenResponse.text();
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const { access_token } = await ttsTokenResponse.json();

    let audioBase64: string;
    let audioDuration: number;
    let audioUrl: string;
    
    try {
      const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
          },
          body: JSON.stringify({
            input: { text: script },
            voice: {
              languageCode: 'en-US',
              name: 'en-US-Neural2-J',
              ssmlGender: 'MALE'
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.0,
              pitch: 0
            }
          })
        }
      );

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        console.error('TTS API error:', errorText);
        throw new Error(`TTS API failed: ${errorText}`);
      }

      const ttsData = await ttsResponse.json();
      audioBase64 = ttsData.audioContent;
      audioDuration = Math.ceil(script.split(/\s+/).length / 2.5);
      console.log('✅ TTS audio generated successfully');
      
      // Upload audio to Supabase Storage to get public URL
      console.log('Uploading audio to Supabase Storage...');
      const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioFilename = `shorts-audio-${dropId}-${Date.now()}.mp3`;
      
      const { data: audioUpload, error: uploadError } = await supabase.storage
        .from('shorts-assets')
        .upload(audioFilename, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Audio upload failed:', uploadError);
        throw new Error(`Failed to upload audio: ${uploadError.message}`);
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('shorts-assets')
        .getPublicUrl(audioFilename);
      
      audioUrl = publicUrl;
      
      console.log('✅ Audio uploaded to:', audioUrl);
    } catch (ttsError) {
      console.error('TTS generation failed:', ttsError);
      throw new Error(`Failed to generate TTS audio: ${ttsError.message}`);
    }

    // Step 3: Upload logo to Supabase Storage for Shotstack
    console.log('Step 3/5: Uploading logo to Supabase Storage...');
    
    // Fetch logo from correct domain and upload to Storage
    const logoResponse = await fetch('https://dailydrops.cloud/favicon.png');
    if (!logoResponse.ok) {
      console.warn('Logo fetch failed, using drop image only');
    }
    
    let logoUrl = '';
    if (logoResponse.ok) {
      const logoBlob = await logoResponse.arrayBuffer();
      const logoFilename = `logo-${Date.now()}.png`;
      
      const { data: logoUpload, error: logoUploadError } = await supabase.storage
        .from('shorts-assets')
        .upload(logoFilename, logoBlob, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (logoUploadError) {
        console.error('Logo upload failed:', logoUploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('shorts-assets')
          .getPublicUrl(logoFilename);
        
        logoUrl = publicUrl;
        console.log('✅ Logo uploaded to:', logoUrl);
      }
    }

    // Step 4: Render video with Shotstack
    console.log('Step 4/5: Rendering video with Shotstack...');
    
    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY');
    if (!shotstackApiKey) {
      throw new Error('SHOTSTACK_API_KEY not configured');
    }

    // Verify script is not empty before rendering
    if (!script || script.trim().length === 0) {
      throw new Error('Script is empty, cannot render video');
    }
    
    console.log('Script for Shotstack (length:', script.length, '):', script.substring(0, 100));

    const dropImageUrl = drop.image_url || 'https://dailydrops.io/topic-default.png';
    
    console.log('Drop image URL:', dropImageUrl);
    console.log('Audio URL:', audioUrl);
    console.log('Audio duration:', audioDuration);
    
    // Create clips array - start with drop image
    const clips = [];
    
    // If we have a logo, show it first for 3 seconds
    if (logoUrl) {
      const logoDuration = Math.min(3, audioDuration / 2);
      clips.push({
        asset: {
          type: 'image',
          src: logoUrl
        },
        start: 0,
        length: logoDuration,
        fit: 'contain',
        scale: 0.5,
        position: 'center',
        transition: {
          in: 'fade',
          out: 'fade'
        }
      });
      
      // Then show drop image
      const imageDuration = Math.max(1, audioDuration - logoDuration);
      clips.push({
        asset: {
          type: 'image',
          src: dropImageUrl
        },
        start: logoDuration,
        length: imageDuration,
        fit: 'cover',
        position: 'center',
        transition: {
          in: 'fade'
        }
      });
      
      console.log('Logo URL:', logoUrl);
      console.log('Clip durations - Logo:', logoDuration, 'Image:', imageDuration);
    } else {
      // No logo, just show drop image for entire duration
      clips.push({
        asset: {
          type: 'image',
          src: dropImageUrl
        },
        start: 0,
        length: audioDuration,
        fit: 'cover',
        position: 'center',
        transition: {
          in: 'fade'
        }
      });
      
      console.log('No logo, using drop image only for', audioDuration, 'seconds');
    }
    
    const shotstackPayload = {
      timeline: {
        soundtrack: {
          src: audioUrl,
          effect: 'fadeInFadeOut'
        },
        background: '#1a1a2e',
        tracks: [
          {
            clips
          }
        ]
      },
      output: {
        format: 'mp4',
        aspectRatio: '9:16',
        size: {
          width: 1080,
          height: 1920
        },
        fps: 30
      }
    };
    
    console.log('Clip durations - Logo:', logoDuration, 'Image:', imageDuration);

    console.log('Shotstack payload:', JSON.stringify(shotstackPayload, null, 2));
    console.log('Sending render request to Shotstack...');
    const renderResponse = await fetch('https://api.shotstack.io/v1/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': shotstackApiKey
      },
      body: JSON.stringify(shotstackPayload)
    });

    if (!renderResponse.ok) {
      const error = await renderResponse.text();
      console.error('Shotstack render failed:', error);
      throw new Error(`Shotstack render failed: ${error}`);
    }

    const renderData = await renderResponse.json();
    const renderId = renderData.response.id;
    console.log('Render started, ID:', renderId);

    // Poll for render completion (max 60s)
    let videoUrl: string | null = null;
    let pollAttempts = 0;
    const maxAttempts = 20; // 20 attempts * 3s = 60s max

    while (pollAttempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s
      
      const statusResponse = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
        headers: { 'x-api-key': shotstackApiKey }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const status = statusData.response.status;
        
        console.log(`Render status (${pollAttempts + 1}/${maxAttempts}):`, status);
        
        if (status === 'done') {
          videoUrl = statusData.response.url;
          console.log('✅ Video rendered:', videoUrl);
          break;
        } else if (status === 'failed') {
          // Log detailed error from Shotstack
          console.error('Shotstack render failed. Full response:', JSON.stringify(statusData, null, 2));
          const errorMessage = statusData.response?.error || 'Unknown Shotstack error';
          throw new Error(`Shotstack render failed: ${errorMessage}`);
        }
      }
      
      pollAttempts++;
    }

    if (!videoUrl) {
      throw new Error('Video render timeout after 60s');
    }

    // Step 5: Download video for upload
    console.log('Step 5/6: Downloading rendered video...');
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video from Shotstack');
    }
    const videoBlob = await videoResponse.arrayBuffer();
    console.log('Video downloaded, size:', Math.ceil(videoBlob.byteLength / 1024), 'KB');

    // Step 6: Upload to YouTube
    console.log('Step 6/6: Uploading to YouTube...');
    
    const youtubeClientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const youtubeClientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
    const youtubeRefreshToken = Deno.env.get('YOUTUBE_REFRESH_TOKEN');

    if (!youtubeClientId || !youtubeClientSecret || !youtubeRefreshToken) {
      throw new Error('YouTube OAuth not configured');
    }

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: youtubeClientId,
        client_secret: youtubeClientSecret,
        refresh_token: youtubeRefreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`YouTube token refresh failed: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('YouTube access token obtained');

    // Upload video to YouTube
    const boundary = '----WebKitFormBoundary' + crypto.randomUUID().replace(/-/g, '');
    
    const metadataPart = JSON.stringify({
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    });

    // Construct multipart body
    const bodyParts = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadataPart,
      `--${boundary}`,
      'Content-Type: video/mp4',
      '',
      ''
    ];

    const textEncoder = new TextEncoder();
    const header = textEncoder.encode(bodyParts.join('\r\n'));
    const footer = textEncoder.encode(`\r\n--${boundary}--`);
    
    const fullBody = new Uint8Array(header.length + videoBlob.byteLength + footer.length);
    fullBody.set(header, 0);
    fullBody.set(new Uint8Array(videoBlob), header.length);
    fullBody.set(footer, header.length + videoBlob.byteLength);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': fullBody.length.toString()
        },
        body: fullBody
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('YouTube upload failed:', error);
      throw new Error(`YouTube upload failed: ${error}`);
    }

    const uploadData = await uploadResponse.json();
    const videoId = uploadData.id;
    console.log('✅ Video uploaded to YouTube:', videoId);

    // Log success event
    await supabase.from('admin_audit_log').insert({
      user_id: user.id,
      action: 'youtube_shorts_publish',
      resource_type: 'drop',
      resource_id: dropId.toString(),
      details: {
        video_id: videoId,
        style,
        script_length: script.split(/\s+/).length,
        render_id: renderId,
        upload_status: 'success'
      }
    });

    const result = {
      success: true,
      mode: 'production',
      platform: 'youtube',
      videoId,
      videoUrl: `https://www.youtube.com/shorts/${videoId}`,
      script: {
        text: script,
        words: script.split(/\s+/).length,
        estimatedDuration: `${audioDuration}s`,
      },
      audio: {
        provider: 'Google Cloud TTS',
        voice: 'en-US-Neural2-J',
        duration: `${audioDuration}s`,
        size: audioBase64 ? `${Math.ceil(audioBase64.length * 0.75 / 1024)}KB` : 'N/A'
      },
      video: {
        status: 'published',
        renderId,
        format: '1080x1920 (9:16), 30fps, h264',
        size: `${Math.ceil(videoBlob.byteLength / 1024)}KB`,
        shotstackUrl: videoUrl
      },
      metadata,
      quotaCost: 100, // YouTube upload costs 100 quota units
      note: '✅ Video pubblicato con successo su YouTube Shorts!',
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in youtube-shorts-publish:', error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to log error
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          await supabase.from('admin_audit_log').insert({
            user_id: user.id,
            action: 'youtube_shorts_publish_error',
            resource_type: 'drop',
            details: {
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
        }
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: 'publish_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
