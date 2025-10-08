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

    // Parse request
    const { dropId, style = 'highlight', text } = await req.json();

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

    console.log('Step 1/3: Generating LinkedIn post text...');

    // Generate LinkedIn post text using OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const postPrompt = text || `Create an engaging LinkedIn post for a 20-30 second video about: "${drop.title}"

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

    const postResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a LinkedIn content strategist. Create professional, engaging posts for tech and innovation content.'
          },
          {
            role: 'user',
            content: postPrompt
          }
        ],
        max_completion_tokens: 500,
      }),
    });

    if (!postResponse.ok) {
      const error = await postResponse.text();
      throw new Error(`Post generation failed: ${error}`);
    }

    const postData = await postResponse.json();
    const postText = postData.choices[0].message.content.trim();

    console.log('Post text generated:', postText);

    // Step 2: Generate video (same process as YouTube but shorter, more professional)
    // Step 2: Generate TTS audio
    console.log('Step 2/5: Generating TTS audio...');
    
    // Generate shorter script for LinkedIn (15-25s)
    const linkedInScript = script.split(/\s+/).slice(0, 50).join(' '); // Max 50 words for LinkedIn
    
    const gcpProject = Deno.env.get('GCLOUD_TTS_PROJECT');
    const gcpKeyBase64 = Deno.env.get('GCLOUD_TTS_SA_JSON_BASE64');
    
    let audioBase64: string;
    let audioDuration: number;
    
    try {
      if (gcpProject && gcpKeyBase64) {
        const ttsResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${Deno.env.get('GCLOUD_API_KEY') || 'demo'}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: linkedInScript },
              voice: {
                languageCode: 'en-US',
                name: 'en-US-Neural2-D', // Professional female voice for LinkedIn
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

        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          audioBase64 = ttsData.audioContent;
          audioDuration = Math.ceil(linkedInScript.split(/\s+/).length / 2.5);
          console.log('✅ TTS audio generated');
        } else {
          throw new Error('TTS failed');
        }
      } else {
        throw new Error('TTS not configured');
      }
    } catch (ttsError) {
      console.warn('TTS generation failed, using estimate:', ttsError);
      audioBase64 = '';
      audioDuration = Math.ceil(linkedInScript.split(/\s+/).length / 2.5);
    }

    // Step 3: Render video with Shotstack (Square format for LinkedIn)
    console.log('Step 3/5: Rendering video with Shotstack (square format)...');
    
    const shotstackApiKey = Deno.env.get('SHOTSTACK_API_KEY');
    if (!shotstackApiKey) {
      throw new Error('SHOTSTACK_API_KEY not configured');
    }

    const shotstackPayload = {
      timeline: {
        soundtrack: audioBase64 ? {
          src: `data:audio/mp3;base64,${audioBase64}`,
          effect: 'fadeInFadeOut'
        } : undefined,
        background: '#0a66c2', // LinkedIn blue gradient
        tracks: [
          {
            clips: [
              {
                asset: {
                  type: 'title',
                  text: linkedInScript,
                  style: 'minimal',
                  color: '#ffffff',
                  size: 'medium',
                  background: 'transparent',
                  position: 'center'
                },
                start: 0,
                length: audioDuration,
                fit: 'none',
                scale: 1,
                transition: {
                  in: 'fade',
                  out: 'fade'
                }
              }
            ]
          }
        ]
      },
      output: {
        format: 'mp4',
        resolution: 'hd',
        aspectRatio: '1:1', // Square for LinkedIn
        size: {
          width: 1080,
          height: 1080
        },
        fps: 30,
        scaleTo: 'crop'
      }
    };

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
      throw new Error(`Shotstack render failed: ${error}`);
    }

    const renderData = await renderResponse.json();
    const renderId = renderData.response.id;
    console.log('Render started, ID:', renderId);

    // Poll for render completion
    let videoUrl: string | null = null;
    let pollAttempts = 0;
    const maxAttempts = 20;

    while (pollAttempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
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
          throw new Error('Shotstack render failed');
        }
      }
      
      pollAttempts++;
    }

    if (!videoUrl) {
      throw new Error('Video render timeout after 60s');
    }

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

    // B. Upload Video
    const uploadVideoResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${linkedinAccessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: videoBlob
    });

    if (!uploadVideoResponse.ok) {
      const error = await uploadVideoResponse.text();
      throw new Error(`LinkedIn video upload failed: ${error}`);
    }

    console.log('✅ Video uploaded to LinkedIn');

    // C. Create Post
    const utmUrl = `https://dailydrops.io/drops/${drop.id}?utm_source=linkedin&utm_medium=video&utm_campaign=${style}`;
    const finalPostText = `${postText}\n\n🔗 ${utmUrl}`;

    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
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
                  text: drop.summary?.substring(0, 200) || drop.title
                },
                media: assetUrn,
                title: {
                  text: drop.title
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

    if (!postResponse.ok) {
      const error = await postResponse.text();
      throw new Error(`LinkedIn post creation failed: ${error}`);
    }

    const postData = await postResponse.json();
    const postUrn = postData.id;
    const postUrl = `https://www.linkedin.com/feed/update/${postUrn}`;
    
    console.log('✅ LinkedIn post created:', postUrl);

    // Log success event
    await supabase.from('admin_audit_log').insert({
      user_id: user.id,
      action: 'linkedin_video_publish',
      resource_type: 'drop',
      resource_id: dropId.toString(),
      details: {
        post_urn: postUrn,
        asset_urn: assetUrn,
        style,
        script_length: linkedInScript.split(/\s+/).length,
        render_id: renderId,
        upload_status: 'success'
      }
    });

    const result = {
      success: true,
      mode: 'production',
      platform: 'linkedin',
      postUrn,
      assetUrn,
      postUrl,
      postText: finalPostText,
      script: {
        text: linkedInScript,
        words: linkedInScript.split(/\s+/).length,
        estimatedDuration: `${audioDuration}s`
      },
      audio: {
        provider: 'Google Cloud TTS',
        voice: 'en-US-Neural2-D',
        duration: `${audioDuration}s`,
        size: audioBase64 ? `${Math.ceil(audioBase64.length * 0.75 / 1024)}KB` : 'N/A'
      },
      video: {
        status: 'published',
        renderId,
        format: '1080x1080 (1:1), 30fps, h264',
        size: `${Math.ceil(videoBlob.byteLength / 1024)}KB`,
        shotstackUrl: videoUrl
      },
      drop: {
        id: drop.id,
        title: drop.title,
        topics: topicNames
      },
      note: '✅ Video pubblicato con successo su LinkedIn!'
    };

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
