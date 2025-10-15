import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PartnerData {
  slug: string;
  name: string;
  title: string | null;
  description_md: string | null;
  logo_url: string | null;
  banner_url: string | null;
}

// Known social media crawler user agents
const socialCrawlers = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'WhatsApp',
  'SkypeUriPreview',
  'Discordbot',
  'Pinterest',
];

function isSocialCrawler(userAgent: string): boolean {
  return socialCrawlers.some(crawler => 
    userAgent.toLowerCase().includes(crawler.toLowerCase())
  );
}

function extractSlugFromPath(pathname: string): string | null {
  // Path format: /partner-slug
  const match = pathname.match(/^\/([^\/]+)$/);
  return match ? match[1] : null;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function generatePartnerHtml(partner: PartnerData): string {
  const baseUrl = 'https://dailydrops.cloud';
  const partnerUrl = `${baseUrl}/${partner.slug}`;
  const title = `${partner.title || partner.name} | DailyDrops`;
  const description = partner.description_md 
    ? stripHtmlTags(partner.description_md).substring(0, 160)
    : `Latest updates from ${partner.name}`;
  const ogImage = partner.logo_url || partner.banner_url || `${baseUrl}/og-dailydrops.jpg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${partnerUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="DailyDrops">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${partnerUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  
  <!-- LinkedIn -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  
  <!-- Canonical -->
  <link rel="canonical" href="${partnerUrl}">
  
  <!-- Redirect browsers to the actual application -->
  <script>
    if (!navigator.userAgent.match(/${socialCrawlers.join('|')}/i)) {
      window.location.href = '${partnerUrl}';
    }
  </script>
  
  <meta http-equiv="refresh" content="0;url=${partnerUrl}">
</head>
<body>
  <h1>${partner.title || partner.name}</h1>
  <p>${description}</p>
  <p>Redirecting to <a href="${partnerUrl}">${partnerUrl}</a>...</p>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const userAgent = req.headers.get('user-agent') || '';
    const slug = extractSlugFromPath(url.pathname);

    console.log('Partner meta request:', { 
      slug, 
      userAgent, 
      isCrawler: isSocialCrawler(userAgent) 
    });

    // If not a social crawler or no slug, redirect to main app
    if (!slug || !isSocialCrawler(userAgent)) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://dailydrops.cloud${url.pathname}`,
        },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch partner data
    const { data: partner, error } = await supabase
      .from('partners')
      .select('slug, name, title, description_md, logo_url, banner_url')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !partner) {
      console.error('Partner not found:', { slug, error });
      // Return fallback HTML
      return new Response(generatePartnerHtml({
        slug,
        name: slug,
        title: null,
        description_md: null,
        logo_url: null,
        banner_url: null,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // 5 minutes
        },
      });
    }

    // Generate and return HTML with meta tags
    const html = generatePartnerHtml(partner);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1 hour
      },
    });

  } catch (error) {
    console.error('Error in partner-meta-server:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
