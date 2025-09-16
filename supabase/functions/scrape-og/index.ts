import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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

// Normalize URL to canonical form
function canonicalUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Force HTTPS
    urlObj.protocol = 'https:';
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ref', 'source', 'campaign'];
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
    
    // Normalize YouTube URLs to watch?v=ID format
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
    
    // Remove trailing slash unless it's the root path
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Failed to canonicalize URL:', url, error);
    return url;
  }
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

// Check if YouTube thumbnail exists and fallback if needed
async function getYouTubeThumbnail(videoId: string): Promise<string> {
  const maxresUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const hqdefaultUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  
  try {
    const response = await fetch(maxresUrl, { method: 'HEAD' });
    if (response.ok && response.headers.get('content-length') !== '0') {
      return maxresUrl;
    }
  } catch (error) {
    console.log('Maxresdefault not available, using hqdefault fallback');
  }
  
  return hqdefaultUrl;
}

// Calculate Authority Score based on source reputation
async function calculateAuthorityScore(sourceId: number | null, url: string): Promise<number> {
  if (!sourceId) return 0.3; // Unknown source gets low authority

  try {
    // Fetch source data
    const sourceResponse = await fetch(`${SUPABASE_URL}/rest/v1/sources?id=eq.${sourceId}&select=official,type,name`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    });
    
    if (!sourceResponse.ok) return 0.5;
    
    const sources = await sourceResponse.json();
    if (!sources || sources.length === 0) return 0.5;
    
    const source = sources[0];
    let score = 0.5; // Base score
    
    // Official sources get higher authority
    if (source.official) score += 0.3;
    
    // Domain-based authority adjustments
    if (url.includes('youtube.com')) score += 0.2;
    if (url.includes('github.com')) score += 0.2;
    if (url.includes('arxiv.org')) score += 0.3;
    if (url.includes('medium.com')) score += 0.1;
    
    return Math.max(0.1, Math.min(1.0, score));
  } catch (error) {
    console.error('Error calculating authority score:', error);
    return 0.5;
  }
}

// Calculate Quality Score based on content characteristics
async function calculateQualityScore(title: string, summary: string, imageUrl: string | null, type: string): Promise<{quality_score: number}> {
  let score = 0.5; // Base score
  
  // Title quality indicators
  if (title.length >= 10 && title.length <= 100) score += 0.1;
  if (title.includes('?') || title.includes(':') || title.includes('How') || title.includes('Why')) score += 0.1;
  
  // Summary quality indicators  
  if (summary.length >= 50) score += 0.1;
  if (summary.length >= 200) score += 0.1;
  
  // Has image
  if (imageUrl) score += 0.1;
  
  // Content type adjustments
  if (type === 'video') score += 0.1; // Videos often have higher engagement
  
  // Avoid clickbait patterns
  const clickbaitPatterns = [
    /\d+ (tricks?|secrets?|tips?)/i,
    /you won't believe/i,
    /this will shock you/i,
    /doctors hate/i
  ];
  
  if (clickbaitPatterns.some(pattern => pattern.test(title))) {
    score -= 0.2;
  }
  
  return {
    quality_score: Math.max(0.1, Math.min(1.0, score))
  };
}

// Calculate Popularity Score (placeholder for now, could integrate with external APIs)
async function calculatePopularityScore(url: string, type: string): Promise<number> {
  try {
    // For YouTube videos, we could extract view count from the page or use YouTube API
    if (url.includes('youtube.com') && type === 'video') {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        // For now, return a base popularity for YouTube videos
        // This could be enhanced with actual YouTube API integration
        return 0.3;
      }
    }
    
    // For other content, could integrate with social media APIs, analytics, etc.
    // For now, return base popularity
    return 0.1;
  } catch (error) {
    console.error('Error calculating popularity score:', error);
    return 0.0;
  }
}

// Extract published date from HTML
function extractPublishedDate(html: string, url: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Try various meta tags for publication date
    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[property="article:modified_time"]', 
      'meta[name="publish_date"]',
      'meta[name="publication_date"]',
      'meta[name="date"]',
      'meta[property="og:updated_time"]',
      'meta[name="DC.Date"]',
      'meta[name="dcterms.created"]'
    ];
    
    for (const selector of metaSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content');
        if (content) {
          const date = parseDate(content);
          if (date) return date;
        }
      }
    }
    
    // Try time elements with datetime attribute
    const timeElements = doc.querySelectorAll('time[datetime]');
    for (const timeEl of timeElements) {
      const datetime = timeEl.getAttribute('datetime');
      if (datetime) {
        const date = parseDate(datetime);
        if (date) return date;
      }
    }
    
    // For Medium articles, try specific selectors
    if (url.includes('medium.com')) {
      const mediumTime = doc.querySelector('time')?.getAttribute('datetime');
      if (mediumTime) {
        const date = parseDate(mediumTime);
        if (date) return date;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting published date:', error);
    return null;
  }
}

// Parse and validate date string
function parseDate(dateString: string): string | null {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return null;
    
    // Check if date is reasonable (not in the future, not too old)
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    
    if (date > now || date < tenYearsAgo) {
      return null;
    }
    
    return date.toISOString();
  } catch (error) {
    return null;
  }
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
    
    // Canonicalize URL and generate hash
    const canonical = canonicalUrl(url);
    const url_hash = await generateSHA1(canonical);
    console.log(`Canonical URL: ${canonical}, Hash: ${url_hash}`);

    // Fetch the HTML content with better error handling and user agent rotation
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'DailyDropsBot/1.0 (+https://dailydrops.co/about)'
    ];
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    let fetchResponse;
    try {
      fetchResponse = await fetch(url, {
        headers: {
          'User-Agent': randomUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout after 30 seconds');
      }
      throw error;
    }

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

    let type: string;
    let title: string;
    let summary: string;
    let image_url: string | null = null;

    // Check if it's a YouTube URL
    const youtubeVideoId = getYouTubeVideoId(url);
    let youtubeMetadata = null;
    
    if (youtubeVideoId) {
      console.log(`YouTube video detected: ${youtubeVideoId}`);
      type = 'video';
      
      // Call YouTube metadata function with retry logic
      const maxRetries = 2
      let lastError: Error | null = null
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Scrape-OG] Fetching YouTube metadata for ${youtubeVideoId} (attempt ${attempt}/${maxRetries})...`);
          
          const metadataResponse = await fetch(`${SUPABASE_URL}/functions/v1/youtube-metadata`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'apikey': SERVICE_ROLE_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ urlOrId: youtubeVideoId }),
          });

          if (metadataResponse.ok) {
            youtubeMetadata = await metadataResponse.json();
            console.log('[Scrape-OG] YouTube metadata fetched successfully:', {
              title: youtubeMetadata.title,
              duration: youtubeMetadata.youtube_duration_seconds,
              views: youtubeMetadata.youtube_view_count
            });
            
            // Use YouTube metadata for title, description, and thumbnail
            title = youtubeMetadata.title;
            summary = youtubeMetadata.title; // Use title as summary for now
            image_url = youtubeMetadata.youtube_thumbnail_url;
            break; // Success - exit retry loop
            
          } else {
            const errorText = await metadataResponse.text();
            const error = `YouTube metadata API failed: ${metadataResponse.status} ${errorText}`;
            console.error(`[Scrape-OG] ${error}`);
            throw new Error(error);
          }
          
        } catch (error) {
          lastError = error as Error;
          console.error(`[Scrape-OG] YouTube metadata attempt ${attempt}/${maxRetries} failed:`, error.message);
          
          // Wait before retrying
          if (attempt < maxRetries) {
            const delay = 2000 * attempt; // 2s, 4s
            console.log(`[Scrape-OG] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If all retries failed, log the error and continue with HTML fallback
      if (!youtubeMetadata && lastError) {
        console.error(`[Scrape-OG] All YouTube metadata attempts failed for ${youtubeVideoId}:`, lastError.message);
      }
      
      // Fallback to HTML parsing if YouTube API failed
      if (!youtubeMetadata) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const titleElement = doc.querySelector('title')?.textContent;
        title = ogTitle || titleElement || 'YouTube Video';
        
        const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        summary = ogDescription || metaDescription || '';

        // Use YouTube thumbnail with fallback
        image_url = await getYouTubeThumbnail(youtubeVideoId);
      }
      
    } else {
      // Regular article parsing using DOMParser
      type = 'article';
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      const titleElement = doc.querySelector('title')?.textContent;
      title = ogTitle || titleElement || 'Untitled';
      
      const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
      const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content');
      summary = ogDescription || metaDescription || '';

      const ogImageElement = doc.querySelector('meta[property="og:image"]');
      const ogImage = ogImageElement?.getAttribute('content');
      if (ogImage) {
        image_url = resolveUrl(url, ogImage);
      }
    }

    console.log(`Parsed content - Title: ${title}, Type: ${type}, Image: ${image_url}`);

    // Extract published date from HTML
    const extractedDate = extractPublishedDate(html, url);
    const finalPublishedAt = extractedDate || new Date().toISOString();
    
    console.log(`Extracted published date: ${extractedDate ? extractedDate : 'null, using current date'}`);

    // Calculate quality scores
    const qualityMetrics = await calculateQualityScore(title.trim(), summary.trim(), image_url, type);
    const authorityScore = await calculateAuthorityScore(source_id, canonical);
    
    // Use YouTube view count for popularity if available, otherwise fallback to default calculation
    let popularityScore;
    if (youtubeMetadata?.youtube_view_count) {
      // Normalize YouTube views using log1p (same as background-feed-ranking)
      popularityScore = Math.log(1 + youtubeMetadata.youtube_view_count) / Math.log(1000);
      popularityScore = Math.max(0, Math.min(1, popularityScore)); // Clamp 0-1
      console.log(`Using YouTube view count for popularity: ${youtubeMetadata.youtube_view_count} views -> ${popularityScore}`);
    } else {
      popularityScore = await calculatePopularityScore(canonical, type);
    }

    console.log(`Calculated scores - Authority: ${authorityScore}, Quality: ${qualityMetrics.quality_score}, Popularity: ${popularityScore}`);

    // Prepare data for upsert - include YouTube metadata if available
    const dropData = {
      url: canonical,
      url_hash,
      type,
      title: title.trim(),
      summary: summary.trim(),
      image_url,
      source_id,
      tags,
      lang_id,
      published_at: youtubeMetadata?.youtube_published_at || finalPublishedAt,
      og_scraped: true,
      authority_score: authorityScore,
      quality_score: qualityMetrics.quality_score,
      popularity_score: popularityScore,
      created_at: new Date().toISOString(),
      // YouTube-specific fields
      ...(youtubeMetadata && {
        youtube_video_id: youtubeMetadata.youtube_video_id,
        youtube_channel_id: youtubeMetadata.youtube_channel_id,
        youtube_published_at: youtubeMetadata.youtube_published_at,
        youtube_category: youtubeMetadata.youtube_category,
        youtube_duration_seconds: youtubeMetadata.youtube_duration_seconds,
        youtube_view_count: youtubeMetadata.youtube_view_count,
        youtube_thumbnail_url: youtubeMetadata.youtube_thumbnail_url,
      }),
    };

    // Upsert into drops table using SERVICE_ROLE with merge-duplicates
    const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/drops`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
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

/*
CURL EXAMPLE:

curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/scrape-og \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "url": "https://example.com/article",
    "source_id": 1,
    "tags": ["tech", "news"],
    "lang_id": 1,
    "published_at": "2024-01-01T00:00:00Z"
  }'

For YouTube:
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/scrape-og \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "source_id": 2,
    "tags": ["video", "music"]
  }'
*/