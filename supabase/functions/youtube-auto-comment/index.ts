import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATIC_TEMPLATES = [
  "This video was featured on DropDaily → {url}\nYour smartest 10-minute tech digest — curated daily.",
  "Spotted this gem while curating today's DropDaily feed → {url}\nJoin us for smarter mornings.",
  "Tagged on DropDaily → {url}\nBecause great ideas deserve more eyes 👀.",
  "Loved this insight — it made today's DropDaily list → {url}\nExplore your daily AI & tech picks.",
  "Quality content like this is why DropDaily exists → {url}\nDiscover, learn, repeat.",
  "Picked for today's DropDaily → {url}\n10 minutes of smart inspiration, every day.",
  "Featured in our DropDaily feed → {url}\nA must-see for curious minds.",
  "We tagged this video on DropDaily → {url}\nJoin our daily dose of tech & innovation.",
  "This made it into DropDaily's daily digest → {url}\nWhere tech meets curiosity.",
  "Found this worth sharing — featured on DropDaily → {url}\nStay sharp with your 10-minute drop."
];

const DAILY_CAP = 50;
const USE_AI_COMMENTS = true;

interface CommentJob {
  id: number;
  video_id: string;
  channel_id: string;
  video_title: string;
  video_description: string;
  topic_slug: string;
  text_hash: string;
  utm_campaign: string;
  utm_content: string;
}

async function generateAIComment(
  title: string,
  description: string,
  topicName: string,
  topicUrl: string,
  openaiKey: string
): Promise<string | null> {
  const prompt = `You're writing a short, human YouTube comment (1–2 sentences, ≤60 tokens).
It should sound authentic, relevant, and include a DropDaily link.

Video title: "${title}"
Description: "${description?.slice(0, 200) || 'N/A'}"
Topic: "${topicName}"
URL: "${topicUrl}"

Examples:
${STATIC_TEMPLATES.map(t => t.replace('{url}', topicUrl)).join('\n')}

Now write one new variant in English, with a friendly and curious tone.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 60
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI_COMMENT_ERROR', { status: response.status, error: errorText });
      return null;
    }

    const data = await response.json();
    const aiComment = data.choices?.[0]?.message?.content?.trim();
    
    if (aiComment && aiComment.length > 10) {
      console.log('AI_COMMENT_SUCCESS', { length: aiComment.length });
      return aiComment;
    }
    
    return null;
  } catch (e) {
    console.error('AI_COMMENT_ERROR', {
      errorType: e.name,
      message: e.message,
      stack: e.stack?.slice(0, 200)
    });
    return null;
  }
}

function pickRandomTemplate(topicUrl: string): string {
  const template = STATIC_TEMPLATES[Math.floor(Math.random() * STATIC_TEMPLATES.length)];
  return template.replace('{url}', topicUrl);
}

async function logEvent(
  supabase: any,
  jobId: number,
  phase: string,
  status: string,
  message: string,
  data?: any
) {
  await supabase.from('social_comment_events').insert({
    job_id: jobId,
    phase,
    status,
    message,
    data: data ? JSON.stringify(data) : null
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check daily cap
    const { data: countData } = await supabase.rpc('get_youtube_comments_today_count');
    const todayCount = countData || 0;

    if (todayCount >= DAILY_CAP) {
      console.log('RATE_LIMIT_SKIP', { todayCount, dailyCap: DAILY_CAP });
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'Daily cap reached',
        todayCount,
        dailyCap: DAILY_CAP
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pending jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('social_comment_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (jobsError) {
      console.error('JOBS_QUERY_ERROR', { error: jobsError });
      return new Response(JSON.stringify({ error: jobsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending jobs',
        todayCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const job = jobs[0] as CommentJob;
    
    // Mark as processing
    await supabase
      .from('social_comment_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    await logEvent(supabase, job.id, 'START', 'ok', 'Processing job', { videoId: job.video_id });

    // Get topic URL
    const { data: topic } = await supabase
      .from('topics')
      .select('name, slug')
      .eq('slug', job.topic_slug)
      .single();

    const topicName = topic?.name || job.topic_slug;
    const topicUrl = `https://dailydrops.info/topic/${job.topic_slug}?utm_source=youtube&utm_medium=comment&utm_campaign=${job.utm_campaign}&utm_content=${job.utm_content}`;

    // Generate comment text
    let textOriginal: string;

    if (USE_AI_COMMENTS && openaiKey) {
      const aiComment = await generateAIComment(
        job.video_title,
        job.video_description,
        topicName,
        topicUrl,
        openaiKey
      );

      if (aiComment) {
        textOriginal = aiComment;
        await logEvent(supabase, job.id, 'AI_COMMENT', 'ok', 'AI comment generated', { length: aiComment.length });
      } else {
        textOriginal = pickRandomTemplate(topicUrl);
        await logEvent(supabase, job.id, 'AI_COMMENT', 'fallback', 'Using fallback template');
      }
    } else {
      textOriginal = pickRandomTemplate(topicUrl);
      await logEvent(supabase, job.id, 'TEMPLATE', 'ok', 'Using static template');
    }

    // Update job with text
    await supabase
      .from('social_comment_jobs')
      .update({ 
        text_original: textOriginal,
        status: 'ready',
        tries: job.tries + 1
      })
      .eq('id', job.id);

    await logEvent(supabase, job.id, 'READY', 'ok', 'Comment prepared for posting', { 
      textPreview: textOriginal.slice(0, 100) 
    });

    // Note: Actual YouTube API posting would go here with OAuth
    // For now, we mark as ready for manual review or future YouTube integration
    console.log('COMMENT_READY', { 
      jobId: job.id, 
      videoId: job.video_id,
      textPreview: textOriginal.slice(0, 100)
    });

    return new Response(JSON.stringify({ 
      success: true, 
      jobId: job.id,
      videoId: job.video_id,
      textPreview: textOriginal.slice(0, 100),
      todayCount: todayCount + 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('WORKER_ERROR', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
