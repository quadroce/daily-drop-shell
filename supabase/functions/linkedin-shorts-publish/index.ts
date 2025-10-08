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
    console.log('Step 2/3: Generating video...');
    
    // For LinkedIn, videos should be:
    // - 3-60 seconds (optimal: 15-30s)
    // - Square (1:1) or vertical (9:16)
    // - Professional, polished look
    // - Captions are crucial
    
    const videoNote = 'Video rendering not implemented in demo. In production: generate 15-30s professional video in 1080x1080 or 1080x1920 format with captions.';
    
    console.log(videoNote);

    // Step 3: Upload to LinkedIn (Demo mode - skip token requirement)
    console.log('Step 3/3: Uploading to LinkedIn (Demo mode)...');

    // LinkedIn video upload process:
    // 1. Initialize upload
    // 2. Upload video chunks
    // 3. Finalize upload
    // 4. Create post with video

    // For demo, simulate the upload
    const mockVideoUrn = 'urn:li:video:DEMO_' + crypto.randomUUID();
    const mockPostId = 'DEMO_' + crypto.randomUUID();
    
    console.log('Mock LinkedIn upload completed');
    console.log('VideoURN:', mockVideoUrn);
    console.log('PostId:', mockPostId);

    // Add UTM parameters to DailyDrops link
    const utmUrl = `https://dailydrops.io/drops/${drop.id}?utm_source=linkedin&utm_medium=video&utm_campaign=${style}`;
    
    const finalPostText = `${postText}\n\n🔗 ${utmUrl}`;

    // Log success event
    await supabase.from('short_job_events').insert({
      stage: 'publish',
      ok: true,
      meta: {
        action: 'publish_shorts',
        platform: 'linkedin',
        drop_id: dropId,
        video_urn: mockVideoUrn,
        post_id: mockPostId,
        style,
        note: 'Demo mode - no actual video uploaded'
      }
    });

    const result = {
      success: true,
      mode: 'demo',
      platform: 'linkedin',
      videoUrn: mockVideoUrn,
      postId: mockPostId,
      postUrl: `https://www.linkedin.com/feed/update/${mockPostId}`,
      postText: finalPostText,
      drop: {
        id: drop.id,
        title: drop.title,
        topics: topicNames
      },
      note: 'Demo mode: Post text generated, video rendering and upload not implemented. In production, this would upload a real video to LinkedIn.',
      nextSteps: [
        'Implement LinkedIn OAuth flow',
        'Integrate LinkedIn Video API',
        'Generate professional square/vertical videos',
        'Add automated captions for accessibility'
      ]
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in linkedin-shorts-publish:', error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('short_job_events').insert({
      stage: 'publish',
      ok: false,
      meta: {
        action: 'publish_shorts',
        platform: 'linkedin',
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
