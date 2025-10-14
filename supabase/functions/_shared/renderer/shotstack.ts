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
  audioUrl: string; // TTS voice audio
  backgroundMusicUrl?: string; // Optional background music
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
 * 
 * Note: We use an underlay track to switch background from white (opening) to black (content + CTA).
 * This is more reliable than relying on timeline.background which doesn't support mid-video transitions.
 */
export function buildShotstackPayload(composition: VideoComposition): ShotstackPayload {
  const { aspect, opening, segments, cta, audioUrl, backgroundMusicUrl, brand = {} } = composition;
  
  const textColor = brand.textColor || '#FFFFFF';
  const bgContent = brand.bgContent || '#000000';
  const bgOpening = brand.bgOpening || '#FFFFFF';
  
  // Determine output size based on aspect ratio
  const size = aspect === 'yt-9x16' 
    ? { width: 1080, height: 1920 }  // YouTube Shorts
    : { width: 1080, height: 1080 };  // LinkedIn
  
  // Helper to apply opening offset
  const withOpening = (t: number) => opening.durationSec + t;
  
  // Filter and validate segments (remove invalid ones where end <= start)
  const validSegments = segments.filter(seg => {
    const duration = seg.end - seg.start;
    if (duration <= 0) {
      console.warn(`Skipping invalid segment with duration ${duration}:`, seg);
      return false;
    }
    return true;
  });
  
  // Calculate total duration with opening offset
  const lastSegmentEnd = validSegments.length > 0 
    ? validSegments[validSegments.length - 1].end 
    : 0;
  const ctaStart = withOpening(lastSegmentEnd);
  const totalDuration = ctaStart + cta.durationSec;
  
  // Track 0: Content underlay (black background for content + CTA, starts after opening)
  // Using solid black image instead of HTML for better compatibility
  const contentUnderlayTrack = {
    clips: [
      {
        asset: {
          type: 'image' as const,
          src: 'https://dummyimage.com/1920x1080/000000/000000.png'  // Solid black 1x1 image scaled to fill
        },
        start: opening.durationSec,
        length: totalDuration - opening.durationSec,
        fit: 'cover',
        scale: 1.0,
        position: 'center'
      }
    ]
  };
  
  // Track 1: Opening logo (white background via timeline.background)
  const openingTrack = {
    clips: [
      {
        asset: {
          type: 'image' as const,
          src: opening.logoUrl
        },
        start: 0,
        length: opening.durationSec,
        fit: 'contain',  // Valid fit value (not 'none')
        scale: 0.6,
        position: 'center',
        opacity: 1.0,
        transition: { in: 'fade', out: 'fade' }
      }
    ]
  };
  
  // Track 2: Text segments synced to TTS (offset by opening duration)
  const textClips = validSegments.map((segment) => ({
    asset: {
      type: 'title' as const,
      text: segment.text,
      style: 'blockbuster',  // Bold style with built-in shadow/outline for visibility
      color: textColor,
      size: 'x-large'  // Extra large for maximum readability
    },
    start: withOpening(segment.start),
    length: Math.max(0.1, segment.end - segment.start),  // Clamp to at least 0.1s
    position: 'center',  // Center position for maximum visibility
    offset: { x: 0, y: 0.25 },  // Slightly below center
    opacity: 1.0,
    transition: { in: 'fade', out: 'fade' }
  }));
  
  // Track 3: CTA (starts after last segment, offset by opening)
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
        transition: { in: 'fade', out: 'fade' }
        // Note: background handled by underlay track
      }
    ]
  };
  
  // Track 4: TTS Voice audio (primary)
  const voiceTrack = {
    clips: [
      {
        asset: {
          type: 'audio' as const,
          src: audioUrl,
          volume: 1.0  // Full volume for voice
        },
        start: opening.durationSec,
        length: totalDuration - opening.durationSec
      }
    ]
  };

  // Track 5: Background music (optional, lower volume)
  const musicTrack = backgroundMusicUrl ? {
    clips: [
      {
        asset: {
          type: 'audio' as const,
          src: backgroundMusicUrl,
          volume: 0.15  // Low volume for background music
        },
        start: opening.durationSec,
        length: totalDuration - opening.durationSec
      }
    ]
  } : null;

  // Build tracks array - audio tracks first (invisible), then visual tracks bottom-to-top
  // In Shotstack, tracks are layered from bottom to top, so order matters for visuals
  const tracks = [
    voiceTrack,            // Track 0: TTS voice audio (invisible, always plays)
    ...(musicTrack ? [musicTrack] : []), // Track 1: Background music (invisible, optional)
    contentUnderlayTrack,  // Track 2: Black background (bottom visual layer, starts at 2s)
    openingTrack,          // Track 3: Opening logo (shows 0-2s on white background)
    { clips: textClips },  // Track 4: Text subtitles (shows 4s+ on black background, MUST be above underlay)
    ctaTrack               // Track 5: CTA (top layer, shows at end)
  ];

  return {
    timeline: {
      background: bgOpening,  // White background for opening only
      tracks
    },
    output: {
      format: 'mp4',
      fps: 30,
      size  // Use ONLY size, no resolution or scaleTo per schema requirements
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
  kind: 'recap' | 'highlight' | 'digest',
  backgroundMusicUrl?: string
): ShotstackPayload {
  const logoUrl = 'https://dailydrops.cloud/favicon.png';
  const topicUrl = `https://dailydrops.cloud/topics/${topicSlug}`;  // HTTPS required
  
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
      durationSec: 3,  // Reduced from 6s to 3s for 20-second video
      topicUrl
    },
    audioUrl,
    backgroundMusicUrl,
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
  const topicUrl = `https://dailydrops.cloud/topics/${topicSlug}`;  // HTTPS required
  
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
      console.warn(`Poll attempt ${attempt + 1} failed with status ${statusResponse.status}`);
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
      // Include full Shotstack response in error for debugging
      throw new Error(`Shotstack render failed: ${JSON.stringify(statusData.response, null, 2)}`);
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
  console.log('Submitting Shotstack render with payload:', JSON.stringify(payload, null, 2));
  
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
    console.error('Shotstack render submission failed:', errorText);
    throw new Error(`Shotstack render failed (${renderResponse.status}): ${errorText}`);
  }

  const renderData = await renderResponse.json();
  console.log('Shotstack render submitted successfully, render ID:', renderData.response.id);
  return renderData.response.id;
}
