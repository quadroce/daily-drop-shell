import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    console.log('RSS request URL:', req.url);
    const pathSegments = url.pathname.split('/');
    const slug = pathSegments[pathSegments.length - 1]?.replace('.rss', '');
    console.log('Extracted slug:', slug, 'from path segments:', pathSegments);

    if (!slug) {
      console.log('No slug found in URL');
      return new Response('Topic slug is required', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get topic information
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id, label, intro')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (topicError || !topic) {
      console.log('Topic not found:', { slug, topicError, topic });
      return new Response('Topic not found', { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    console.log('Found topic:', { id: topic.id, label: topic.label });

    // Get last 30 days of drops for this topic
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const { data: articles, error: articlesError } = await supabase
      .from('drops')
      .select(`
        id,
        title,
        url,
        summary,
        image_url,
        created_at,
        published_at,
        sources (
          name
        ),
        content_topics!inner (
          topic_id
        )
      `)
      .eq('content_topics.topic_id', topic.id)
      .gte('published_at', cutoffDate.toISOString())
      .eq('tag_done', true)
      .order('published_at', { ascending: false })
      .limit(200);

    if (articlesError) {
      console.error('Error fetching articles:', articlesError);
      return new Response('Error fetching articles', { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    console.log(`Found ${articles?.length || 0} articles for topic ${slug}`);

    // Build RSS feed
    const rssItems = (articles || []).map(article => {
      const pubDate = new Date(article.published_at || article.created_at).toUTCString();
      const description = article.summary || `Article from ${article.sources?.name || 'Unknown Source'}`;
      
      return `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${article.url}</link>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <guid>${article.url}</guid>
      ${article.image_url ? `<enclosure url="${article.image_url}" type="image/jpeg" />` : ''}
    </item>`;
    }).join('');

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>DailyDrops - ${topic.label}</title>
    <link>https://dailydrops.cloud/topics/${slug}</link>
    <description>Daily curated content about ${topic.label}. ${topic.intro || ''}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://dailydrops.cloud/rss-feed/topics/${slug}.rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;

    return new Response(rssXml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600', // 10 minutes cache
      },
    });

  } catch (error) {
    console.error('RSS feed error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
});