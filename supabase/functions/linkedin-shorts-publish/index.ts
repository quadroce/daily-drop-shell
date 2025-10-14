import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLinkedInVideoPayload, submitShotstackRender, pollShotstackRender } from '../_shared/renderer/shotstack.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Publishing LinkedIn video...');
    
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

    // Parse request - support both drop-based and topic-based digest
    const { dropId, topicSlug, style = 'highlight', text } = await req.json();

    // Determine mode
    const isTopicDigest = !!topicSlug;

    if (!dropId && !topicSlug) {
      return new Response(JSON.stringify({ error: 'Either dropId or topicSlug is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let drop: any = null;
    let topicData: any = null;
    let topicNames = 'tech';
    let recentItems: any[] = [];

    if (isTopicDigest) {
      // Topic Digest Mode - fetch topic and recent content
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
        .from('drops')
        .select('*, sources(name)')
        .eq('id', dropId)
        .single();

      if (dropError || !fetchedDrop) {
        throw new Error('Drop not found');
      }

      drop = fetchedDrop;

      // Get topics
      const { data: topics } = await supabase
        .from('content_topics')
        .select('topics(slug, name)')
        .eq('content_id', dropId);

      topicNames = topics?.map((t: any) => t.topics.name).join(', ') || 'tech';
    }

    console.log('Step 1/5: Generating LinkedIn post text...');

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

    // Generate LinkedIn post text using OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    let postPrompt: string;
    let scriptLines: string[];

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

        const scriptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You write concise, scannable on-screen captions for short social videos. No emojis.'
              },
              {
                role: 'user',
                content: scriptPromptText
              }
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });

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

      // LinkedIn post text for Topic Digest
      const hashtags = topicData.label.toLowerCase().split(/\s+/).slice(0, 2)
        .map((w: string) => `#${w}`)
        .join(' ');
      
      postPrompt = `Today in ${topicData.label}: 3 quick highlights.\nhttps://dailydrops.cloud/topics/${topicSlug}\n\n${hashtags} #tech`;
    } else {
      // Original Drop Mode
      postPrompt = text || `Create an engaging LinkedIn post for a 20-30 second video about: "${drop.title}"

Summary: ${drop.summary || 'No summary available'}
Topics: ${topicNames}
Source: ${drop.sources?.name || 'Unknown'}

Requirements:
- Professional yet conversational tone
- 100-200 characters max
- Include 2-3 relevant hashtags
- Call-to-action to visit dailydrops.io
- Emphasize ONE key insight

Write only the post text, no quotes or extra formatting.`;
    }

    let postText: string;

    if (!isTopicDigest) {
      const scriptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a LinkedIn content strategist. Create professional, engaging posts for tech and innovation content.'
            },
            {
              role: 'user',
              content: postPrompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!scriptResponse.ok) {
        const error = await scriptResponse.text();
        throw new Error(`Post generation failed: ${error}`);
      }

      const scriptData = await scriptResponse.json();
      postText = scriptData.choices[0].message.content.trim();
    } else {
      postText = postPrompt;
    }

    console.log('Post text generated:', postText);

    // Step 2: Generate TTS audio (or use script lines for Topic Digest)
    console.log('Step 2/5: Generating TTS audio...');
    
    // For Topic Digest, skip TTS (will use text overlays only)
    const linkedInScript = isTopicDigest
      ? scriptLines.join(' ')
      : postText.split(/\s+/).slice(0, 50).join(' ');
    
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
      privateKey as any
    );

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();
    
    let audioBase64: string;
    let audioDuration: number;
    let ttsAudioUrl: string | undefined;
    
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
            input: { text: linkedInScript },
            voice: {
              languageCode: 'en-US',
              name: 'en-US-Neural2-F', // Professional female voice for LinkedIn
              ssmlGender: 'FEMALE'
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
      audioDuration = Math.ceil(linkedInScript.split(/\s+/).length / 2.5);
      
      // Upload TTS audio to storage and get public URL
      if (!isTopicDigest) {
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const filePath = `tts/${crypto.randomUUID()}.mp3`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('music')
          .upload(filePath, audioBytes, { contentType: 'audio/mpeg', upsert: false });
        
        if (uploadError) {
          console.warn('Failed to upload TTS to storage:', uploadError);
        } else {
          const { data: publicData } = supabase.storage.from('music').getPublicUrl(filePath);
          ttsAudioUrl = publicData.publicUrl;
          console.log('TTS audio uploaded to storage:', ttsAudioUrl);
        }
      }
      
      console.log('✅ TTS audio generated successfully');
    } catch (ttsError) {
      console.error('TTS generation failed:', ttsError);
      const errorMessage = ttsError instanceof Error ? ttsError.message : 'Unknown TTS error';
      throw new Error(`Failed to generate TTS audio: ${errorMessage}`);
    }

    // Step 3: Render video with Shotstack (Square format for LinkedIn)
    console.log('Step 3/5: Rendering video with Shotstack (square format)...');
    
    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY');
    if (!shotstackApiKey) {
      throw new Error('SHOTSTACK_API_KEY not configured');
    }

    // Use shared renderer module (fixes resolution/size conflict)
    const shotstackPayload = buildLinkedInVideoPayload(
      scriptLines,
      logoUrl,
      musicUrl,
      isTopicDigest
    );

    // Submit render job
    const renderId = await submitShotstackRender(shotstackPayload, shotstackApiKey);
    console.log('Render started, ID:', renderId);

    // Poll for completion
    const { videoUrl } = await pollShotstackRender(renderId, shotstackApiKey, 30, 3000);
    console.log('✅ Video rendered:', videoUrl);

    // Step 4: Download video
    console.log('Step 4/5: Downloading rendered video...');
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video from Shotstack');
    }
    const videoBlob = await videoResponse.arrayBuffer();
    console.log('Video downloaded, size:', Math.ceil(videoBlob.byteLength / 1024), 'KB');

    // Step 5: Upload to LinkedIn
    console.log('Step 5/5: Uploading to LinkedIn...');
    
    const linkedinAccessToken = Deno.env.get('LINKEDIN_ACCESS_TOKEN');
    const linkedinPageUrn = Deno.env.get('LINKEDIN_PAGE_URN');

    if (!linkedinAccessToken || !linkedinPageUrn) {
      throw new Error('LinkedIn credentials not configured');
    }

    // A. Initialize Upload
    const initResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
          owner: linkedinPageUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }
          ]
        }
      })
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      throw new Error(`LinkedIn init upload failed: ${error}`);
    }

    const initData = await initResponse.json();
    const uploadUrl = initData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const assetUrn = initData.value.asset;
    console.log('Upload initialized, asset:', assetUrn);

    // B. Upload Video (no Authorization, add Content-Length)
    const uploadVideoResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(videoBlob.byteLength)
      },
      body: videoBlob
    });

    if (!uploadVideoResponse.ok) {
      const error = await uploadVideoResponse.text();
      throw new Error(`LinkedIn video upload failed: ${error}`);
    }

    console.log('✅ Video uploaded to LinkedIn');

    // C. Create Post
    const utmUrl = isTopicDigest
      ? `https://dailydrops.cloud/topics/${topicSlug}?utm_source=linkedin&utm_medium=video&utm_campaign=digest`
      : `https://dailydrops.io/drops/${drop.id}?utm_source=linkedin&utm_medium=video&utm_campaign=${style}`;
    const finalPostText = `${postText}\n\n🔗 ${utmUrl}`;

    const createPostResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        author: linkedinPageUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: finalPostText
            },
            shareMediaCategory: 'VIDEO',
            media: [
              {
                status: 'READY',
                description: {
                  text: isTopicDigest
                    ? `Today in ${topicData.label}: highlights from DailyDrops`
                    : (drop.summary?.substring(0, 200) || drop.title)
                },
                media: assetUrn,
                title: {
                  text: isTopicDigest ? `Today in ${topicData.label}` : drop.title
                }
              }
            ]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      })
    });

    if (!createPostResponse.ok) {
      const error = await createPostResponse.text();
      throw new Error(`LinkedIn post creation failed: ${error}`);
    }

    const createPostData = await createPostResponse.json();
    const postUrn = createPostData.id;
    const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}`;
    
    console.log('✅ LinkedIn post created:', postUrl);

    // Log success event
    await supabase.from('admin_audit_log').insert({
      user_id: user.id,
      action: 'linkedin_video_publish',
      resource_type: isTopicDigest ? 'topic' : 'drop',
      resource_id: isTopicDigest ? topicSlug : dropId.toString(),
      details: {
        mode: isTopicDigest ? 'topic_digest' : 'drop',
        post_urn: postUrn,
        asset_urn: assetUrn,
        style,
        script_length: linkedInScript.split(/\s+/).length,
        render_id: renderId,
        upload_status: 'success',
        ...(isTopicDigest && {
          topic_slug: topicSlug,
          topic_id: topicData.id,
          items_count: recentItems.length,
          music_url: musicUrl,
          logo_url: logoUrl
        })
      }
    });

    const result: any = {
      success: true,
      mode: isTopicDigest ? 'topic_digest' : 'production',
      platform: 'linkedin',
      postUrn,
      assetUrn,
      postUrl,
      postText: finalPostText,
      video: {
        status: 'published',
        renderId,
        format: '1080x1080 (1:1), 30fps, h264',
        size: `${Math.ceil(videoBlob.byteLength / 1024)}KB`,
        shotstackUrl: videoUrl
      }
    };

    if (isTopicDigest) {
      result.topic = {
        slug: topicSlug,
        name: topicData.label,
        id: topicData.id
      };
      result.script = {
        lines: scriptLines,
        words: scriptLines.join(' ').split(/\s+/).length
      };
      if (musicUrl) result.music = { url: musicUrl };
    } else {
      result.script = {
        text: linkedInScript,
        words: linkedInScript.split(/\s+/).length,
        estimatedDuration: `${audioDuration}s`
      };
      result.audio = {
        provider: 'Google Cloud TTS',
        voice: 'en-US-Neural2-F',
        duration: `${audioDuration}s`,
        size: audioBase64 ? `${Math.ceil(audioBase64.length * 0.75 / 1024)}KB` : 'N/A'
      };
      result.drop = {
        id: drop.id,
        title: drop.title,
        topics: topicNames
      };
      result.utm = {
        url: utmUrl,
        campaign: style
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in linkedin-shorts-publish:', error);
    
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
            action: 'linkedin_video_publish_error',
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
