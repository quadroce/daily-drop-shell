import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TopicData {
  slug: string;
  label: string;
  intro: string | null;
}

const socialCrawlers = [
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'skypebot',
  'googlebot',
  'bingbot',
]

function isSocialCrawler(userAgent: string): boolean {
  const lowercaseUA = userAgent.toLowerCase();
  return socialCrawlers.some(crawler => lowercaseUA.includes(crawler));
}

function extractSlugFromPath(pathname: string): string | null {
  // Extract slug from paths like /topics/ai-ml or /topics/business
  const match = pathname.match(/^\/topics\/([^\/]+)/);
  return match ? match[1] : null;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function generateTopicHtml(topic: TopicData): string {
  const title = `${topic.label} - DailyDrops`;
  const description = topic.intro 
    ? stripHtmlTags(topic.intro).substring(0, 160)
    : `Get curated ${topic.label} news and insights for busy professionals on DailyDrops.`;
  
  const url = `https://dailydrops.cloud/topics/${topic.slug}`;
  const imageUrl = `https://dailydrops.cloud/og-dailydrops.jpg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="DailyDrops">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${topic.label} news and insights - DailyDrops">
  <meta property="og:url" content="${url}">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@DailyDrops">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${topic.label} news and insights - DailyDrops">
  
  <!-- LinkedIn -->
  <meta property="article:author" content="DailyDrops">
  <meta property="article:publisher" content="DailyDrops">
  
  <!-- Canonical -->
  <link rel="canonical" href="${url}">
  
  <!-- Redirect to actual page -->
  <script>
    window.location.href = "${url}";
  </script>
  <meta http-equiv="refresh" content="0; url=${url}">
</head>
<body>
  <h1>${topic.label} - DailyDrops</h1>
  <p>${description}</p>
  <p>If you are not redirected automatically, <a href="${url}">click here</a>.</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userAgent = req.headers.get('user-agent') || '';
    const url = new URL(req.url);
    const slug = extractSlugFromPath(url.pathname);

    // If no slug found, return 404
    if (!slug) {
      return new Response('Topic not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Only serve special HTML to social crawlers
    if (!isSocialCrawler(userAgent)) {
      // For regular users, redirect to the main app
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `https://dailydrops.cloud/topics/${slug}`
        }
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch topic data
    const { data: topic, error } = await supabase
      .from('topics')
      .select('slug, label, intro')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !topic) {
      console.error('Error fetching topic:', error);
      // Fallback data for unknown topics
      const fallbackTopic: TopicData = {
        slug,
        label: slug.charAt(0).toUpperCase() + slug.slice(1).replace('-', ' '),
        intro: null
      };
      const html = generateTopicHtml(fallbackTopic);
      return new Response(html, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300' // 5 minutes cache
        }
      });
    }

    // Generate HTML with topic-specific meta tags
    const html = generateTopicHtml(topic);
    
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      }
    });

  } catch (error) {
    console.error('Error in topic-meta-server:', error);
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});