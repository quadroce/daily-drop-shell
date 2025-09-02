import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { load } from "npm:cheerio@1";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
  source_id?: number;
  tags?: string[];
  lang_id?: number;
  published_at?: string | null;
}

// Generate SHA1 hash
async function generateSHA1(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Resolve relative URLs to absolute URLs
function resolveUrl(baseUrl: string, relativeUrl: string): string {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http')) return relativeUrl;
  if (relativeUrl.startsWith('//')) return `https:${relativeUrl}`;
  if (relativeUrl.startsWith('/')) {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${relativeUrl}`;
  }
  return new URL(relativeUrl, baseUrl).href;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: ScrapeRequest = await req.json();
    const { url, source_id, tags = [], lang_id, published_at } = body;

    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Scraping URL: ${url}`);

    // Fetch the HTML content
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent': 'DailyDropsBot/1.0',
      },
      redirect: 'follow',
    });

    if (!fetchResponse.ok) {
      const error = `Failed to fetch URL: ${fetchResponse.status} ${fetchResponse.statusText}`;
      console.error(error);
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await fetchResponse.text();
    console.log('HTML fetched successfully, parsing...');

    // Generate URL hash
    const url_hash = await generateSHA1(url);

    let type: string;
    let title: string;
    let summary: string;
    let image_url: string | null = null;

    // Check if it's a YouTube URL
    const youtubeVideoId = getYouTubeVideoId(url);
    if (youtubeVideoId) {
      console.log(`YouTube video detected: ${youtubeVideoId}`);
      type = 'video';
      
      // Parse title from HTML
      const $ = load(html);
      title = $('meta[property="og:title"]').attr('content') || 
              $('title').text() || 
              'YouTube Video';
      
      summary = $('meta[property="og:description"]').attr('content') || 
                $('meta[name="description"]').attr('content') || 
                '';

      // Use YouTube thumbnail URLs (maxresdefault with hqdefault fallback)
      image_url = `https://i.ytimg.com/vi/${youtubeVideoId}/maxresdefault.jpg`;
      
    } else {
      // Regular article parsing
      type = 'article';
      const $ = load(html);
      
      title = $('meta[property="og:title"]').attr('content') || 
              $('title').text() || 
              'Untitled';
      
      summary = $('meta[property="og:description"]').attr('content') || 
                $('meta[name="description"]').attr('content') || 
                '';

      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        image_url = resolveUrl(url, ogImage);
      }
    }

    console.log(`Parsed content - Title: ${title}, Type: ${type}, Image: ${image_url}`);

    // Prepare data for upsert
    const dropData = {
      url,
      url_hash,
      type,
      title: title.trim(),
      summary: summary.trim(),
      image_url,
      source_id,
      tags,
      lang_id,
      published_at,
      created_at: new Date().toISOString(),
    };

    // Upsert into drops table using SERVICE_ROLE
    const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/drops`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(dropData),
    });

    if (!upsertResponse.ok) {
      const errorText = await upsertResponse.text();
      const error = `Failed to upsert drop: ${upsertResponse.status} ${errorText}`;
      console.error(error);
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await upsertResponse.json();
    console.log('Drop upserted successfully:', result);

    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-og function:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});