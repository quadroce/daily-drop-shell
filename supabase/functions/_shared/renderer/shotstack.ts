/**
 * Shared Shotstack renderer module
 * Generates Shotstack API payloads for YouTube (9:16) and LinkedIn (1:1) videos
 * 
 * Video composition:
 * - Opening: white background + DailyDrops favicon (2s)
 * - Content: black background + text synced to TTS
 * - CTA: black background + call-to-action with topic link
 */

export interface VideoSegment {
  text: string;
  start: number;
  end: number;
}

export interface VideoComposition {
  aspect: 'yt-9x16' | 'li-1x1';
  opening: {
    logoUrl: string;
    durationSec: number;
  };
  segments: VideoSegment[];
  cta: {
    textLines: string[];
    durationSec: number;
    topicUrl: string;
  };
  audioUrl: string;
  brand?: {
    textColor?: string;
    bgContent?: string;
    bgOpening?: string;
  };
}

export interface ShotstackPayload {
  timeline: {
    background: string;
    tracks: Array<{
      clips: Array<{
        asset: {
          type: 'image' | 'title' | 'audio';
          src?: string;
          text?: string;
          style?: string;
          color?: string;
          size?: string;
        };
        start: number;
        length: number;
        fit?: string;
        scale?: number;
        position?: string;
        offset?: { x: number; y: number };
        opacity?: number;
        transition?: { in?: string; out?: string };
        background?: string | null;
        effect?: string;
        volume?: number;
      }>
    }>;
  };
  output: {
    format: 'mp4';
    fps: number;
    size: { width: number; height: number };
    scaleTo?: 'crop';
  };
}

/**
 * Build Shotstack payload with proper video composition:
 * Opening (white + favicon) → Content (black + text synced to TTS) → CTA (black + link)
 */
export function buildShotstackPayload(composition: VideoComposition): ShotstackPayload {
  const { aspect, opening, segments, cta, audioUrl, brand = {} } = composition;
  
  const textColor = brand.textColor || '#FFFFFF';
  const bgContent = brand.bgContent || '#000000';
  const bgOpening = brand.bgOpening || '#FFFFFF';
  
  // Determine output size based on aspect ratio
  const size = aspect === 'yt-9x16' 
    ? { width: 1080, height: 1920 }  // YouTube Shorts
    : { width: 1080, height: 1080 };  // LinkedIn
  
  // Calculate total duration
  const lastSegmentEnd = segments.length > 0 ? segments[segments.length - 1].end : opening.durationSec;
  const ctaStart = lastSegmentEnd;
  const totalDuration = ctaStart + cta.durationSec;
  
  // Track 0: Opening logo (white background)
  const openingTrack = {
    clips: [
      {
        asset: {
          type: 'image' as const,
          src: opening.logoUrl
        },
        start: 0,
        length: opening.durationSec,
        fit: 'none',
        scale: 0.6,
        position: 'center',
        opacity: 1.0,
        transition: { in: 'fade', out: 'fade' }
      }
    ]
  };
  
  // Track 1: Background fill for content (black)
  const contentBgTrack = {
    clips: [
      {
        asset: {
          type: 'title' as const,
          text: '',
          style: 'minimal'
        },
        start: opening.durationSec,
        length: totalDuration - opening.durationSec,
        background: bgContent
      }
    ]
  };
  
  // Track 2: Text segments synced to TTS
  const textClips = segments.map((segment, idx) => ({
    asset: {
      type: 'title' as const,
      text: segment.text,
      style: 'minimal',
      color: textColor,
      size: 'medium'
    },
    start: segment.start,
    length: segment.end - segment.start,
    position: 'center',
    offset: { x: 0, y: 0 },
    opacity: 1.0,
    transition: { in: 'fade', out: 'fade' },
    background: null,
    effect: idx === 0 ? 'zoom' : undefined
  }));
  
  // Track 3: CTA
  const ctaTrack = {
    clips: [
      {
        asset: {
          type: 'title' as const,
          text: cta.textLines.join('\n'),
          style: 'minimal',
          color: textColor,
          size: 'medium'
        },
        start: ctaStart,
        length: cta.durationSec,
        position: 'center',
        background: bgContent,
        transition: { in: 'fade', out: 'fade' }
      }
    ]
  };
  
  // Track 4: Audio
  const audioTrack = {
    clips: [
      {
        asset: {
          type: 'audio' as const,
          src: audioUrl
        },
        start: opening.durationSec,
        length: totalDuration - opening.durationSec,
        volume: 1.0
      }
    ]
  };

  return {
    timeline: {
      background: bgOpening,
      tracks: [
        openingTrack,
        contentBgTrack,
        { clips: textClips },
        ctaTrack,
        audioTrack
      ]
    },
    output: {
      format: 'mp4',
      fps: 30,
      size,  // Use ONLY size, NOT resolution
      ...(aspect === 'li-1x1' && { scaleTo: 'crop' as const })
    }
  };
}

/**
 * Build YouTube Shorts payload (9:16 aspect ratio)
 * Opening → Content → CTA
 */
export function buildYouTubeShortsPayload(
  segments: VideoSegment[],
  audioUrl: string,
  topicSlug: string,
  kind: 'recap' | 'highlight' | 'digest'
): ShotstackPayload {
  const logoUrl = 'https://dailydrops.cloud/favicon.png';
  const topicUrl = `dailydrops.cloud/topics/${topicSlug}`;
  
  return buildShotstackPayload({
    aspect: 'yt-9x16',
    opening: {
      logoUrl,
      durationSec: 2
    },
    segments,
    cta: {
      textLines: [
        `See all links on DailyDrops → ${topicUrl}`,
        'Join free.'
      ],
      durationSec: 6,
      topicUrl
    },
    audioUrl,
    brand: {
      textColor: '#FFFFFF',
      bgContent: '#000000',
      bgOpening: '#FFFFFF'
    }
  });
}

/**
 * Build LinkedIn video payload (1:1 aspect ratio)
 * Opening → Content → CTA
 */
export function buildLinkedInVideoPayload(
  segments: VideoSegment[],
  audioUrl: string,
  topicSlug: string,
  kind: 'recap' | 'highlight' | 'digest'
): ShotstackPayload {
  const logoUrl = 'https://dailydrops.cloud/favicon.png';
  const topicUrl = `dailydrops.cloud/topics/${topicSlug}`;
  
  return buildShotstackPayload({
    aspect: 'li-1x1',
    opening: {
      logoUrl,
      durationSec: 2
    },
    segments,
    cta: {
      textLines: [
        `See all links on DailyDrops → ${topicUrl}`,
        'Join free.'
      ],
      durationSec: 6,
      topicUrl
    },
    audioUrl,
    brand: {
      textColor: '#FFFFFF',
      bgContent: '#000000',
      bgOpening: '#FFFFFF'
    }
  });
}

/**
 * Poll Shotstack for render completion
 */
export async function pollShotstackRender(
  renderId: string,
  apiKey: string,
  maxAttempts: number = 30,
  pollInterval: number = 3000
): Promise<{ videoUrl: string; status: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(
      `https://api.shotstack.io/v1/render/${renderId}`,
      {
        headers: { 'x-api-key': apiKey }
      }
    );

    if (!statusResponse.ok) {
      console.warn(`Poll attempt ${attempt + 1} failed`);
      continue;
    }

    const statusData = await statusResponse.json();
    const status = statusData.response.status;
    
    console.log(`Render status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);

    if (status === 'done') {
      return {
        videoUrl: statusData.response.url,
        status: 'done'
      };
    } else if (status === 'failed') {
      throw new Error(`Shotstack render failed: ${JSON.stringify(statusData.response)}`);
    }
  }

  throw new Error(`Render timeout after ${maxAttempts * pollInterval / 1000}s`);
}

/**
 * Submit render job to Shotstack
 */
export async function submitShotstackRender(
  payload: ShotstackPayload,
  apiKey: string
): Promise<string> {
  const renderResponse = await fetch('https://api.shotstack.io/v1/render', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!renderResponse.ok) {
    const errorText = await renderResponse.text();
    console.error('Shotstack render error:', errorText);
    throw new Error(`Shotstack render failed: ${errorText}`);
  }

  const renderData = await renderResponse.json();
  return renderData.response.id;
}
