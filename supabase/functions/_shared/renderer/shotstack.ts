/**
 * Shared Shotstack renderer module
 * Generates Shotstack API payloads for both YouTube (9:16) and LinkedIn (1:1) videos
 */

export interface ShotstackClip {
  asset: {
    type: 'image' | 'title';
    src?: string;
    text?: string;
    style?: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    position?: 'center' | 'top' | 'bottom';
  };
  start: number;
  length: number;
  fit?: 'crop' | 'cover' | 'contain' | 'none';
  scale?: number;
  position?: 'center' | 'top' | 'bottom';
  filter?: 'blur';
  transition?: {
    in?: 'fade' | 'slideLeft' | 'slideRight';
    out?: 'fade' | 'slideLeft' | 'slideRight';
  };
}

export interface ShotstackOptions {
  platform: 'youtube' | 'linkedin';
  clips: ShotstackClip[];
  totalDuration: number;
  musicUrl?: string;
  backgroundColor?: string;
}

export interface ShotstackPayload {
  timeline: {
    soundtrack?: {
      src: string;
      effect: 'fadeInFadeOut';
    };
    background?: string;
    tracks: Array<{ clips: ShotstackClip[] }>;
  };
  output: {
    format: 'mp4';
    size: { width: number; height: number };
    fps: number;
    scaleTo?: 'crop';
  };
}

/**
 * Generate Shotstack payload
 * CRITICAL: Only uses `size` field, never `resolution` to avoid API conflicts
 */
export function buildShotstackPayload(options: ShotstackOptions): ShotstackPayload {
  const { platform, clips, totalDuration, musicUrl, backgroundColor = '#0a66c2' } = options;

  // Determine output size based on platform
  const outputSize = platform === 'youtube'
    ? { width: 1080, height: 1920 } // 9:16 vertical
    : { width: 1080, height: 1080 }; // 1:1 square

  const payload: ShotstackPayload = {
    timeline: {
      background: backgroundColor,
      tracks: [{ clips }]
    },
    output: {
      format: 'mp4',
      size: outputSize, // ONLY use size, not resolution
      fps: 30
    }
  };

  // Add soundtrack if provided
  if (musicUrl) {
    payload.timeline.soundtrack = {
      src: musicUrl,
      effect: 'fadeInFadeOut'
    };
  }

  // Add scaleTo for LinkedIn to ensure proper cropping
  if (platform === 'linkedin') {
    payload.output.scaleTo = 'crop';
  }

  return payload;
}

/**
 * Build YouTube Shorts payload with background image and text overlays
 */
export function buildYouTubeShortsPayload(
  scriptLines: string[],
  logoUrl: string | null,
  musicUrl: string | null,
  backgroundImageUrl?: string
): ShotstackPayload {
  const clips: ShotstackClip[] = [];
  let currentTime = 0;

  // Logo intro (1.2s)
  if (logoUrl) {
    clips.push({
      asset: {
        type: 'image',
        src: logoUrl
      },
      start: currentTime,
      length: 1.2,
      fit: 'contain',
      scale: 0.4,
      position: 'center',
      transition: { in: 'fade', out: 'fade' }
    });
    currentTime += 1.2;
  }

  // Text clips (6s each)
  for (const line of scriptLines) {
    const duration = 6;
    clips.push({
      asset: {
        type: 'title',
        text: line,
        style: 'minimal',
        color: '#000000',
        size: 'medium',
        position: 'center'
      },
      start: currentTime,
      length: duration,
      fit: 'none',
      scale: 1,
      transition: { in: 'fade', out: 'fade' }
    });
    currentTime += duration;
  }

  // Background track (blurred image if provided)
  const tracks: Array<{ clips: ShotstackClip[] }> = [];
  
  if (backgroundImageUrl) {
    const backgroundClip: ShotstackClip = {
      asset: {
        type: 'image',
        src: backgroundImageUrl
      },
      start: 0,
      length: currentTime,
      fit: 'cover',
      scale: 1.2,
      filter: 'blur'
    };
    tracks.push({ clips: [backgroundClip] });
  }
  
  // Foreground track (logo + text)
  tracks.push({ clips });

  return {
    timeline: {
      ...(musicUrl && {
        soundtrack: {
          src: musicUrl,
          effect: 'fadeInFadeOut' as const
        }
      }),
      tracks
    },
    output: {
      format: 'mp4',
      size: { width: 1080, height: 1920 },
      fps: 30
    }
  };
}

/**
 * Build LinkedIn video payload (square format)
 */
export function buildLinkedInVideoPayload(
  scriptLines: string[],
  logoUrl: string | null,
  musicUrl: string | null,
  isTopicDigest: boolean
): ShotstackPayload {
  const clips: ShotstackClip[] = [];
  let currentTime = 0;

  if (isTopicDigest) {
    // Logo intro (1.2s)
    if (logoUrl) {
      clips.push({
        asset: {
          type: 'image',
          src: logoUrl
        },
        start: currentTime,
        length: 1.2,
        fit: 'none',
        scale: 0.5,
        position: 'center',
        transition: { in: 'fade', out: 'fade' }
      });
      currentTime += 1.2;
    }

    // Title (2s)
    clips.push({
      asset: {
        type: 'title',
        text: scriptLines[0],
        style: 'minimal',
        color: '#ffffff',
        size: 'large',
        position: 'center'
      },
      start: currentTime,
      length: 2.0,
      fit: 'none',
      scale: 1,
      transition: { in: 'fade', out: 'fade' }
    });
    currentTime += 2.0;

    // Highlights (7s each)
    for (let i = 1; i < scriptLines.length - 1 && i < 4; i++) {
      clips.push({
        asset: {
          type: 'title',
          text: scriptLines[i],
          style: 'minimal',
          color: '#ffffff',
          size: 'medium',
          position: 'center'
        },
        start: currentTime,
        length: 7.0,
        fit: 'none',
        scale: 1,
        transition: { in: 'fade', out: 'fade' }
      });
      currentTime += 7.0;
    }

    // CTA (4.5s)
    clips.push({
      asset: {
        type: 'title',
        text: scriptLines[scriptLines.length - 1],
        style: 'minimal',
        color: '#ffffff',
        size: 'medium',
        position: 'center'
      },
      start: currentTime,
      length: 4.5,
      fit: 'none',
      scale: 1,
      transition: { in: 'fade', out: 'fade' }
    });
    currentTime += 4.5;
  } else {
    // Single text clip for drop-based videos
    const audioDuration = Math.ceil(scriptLines.join(' ').split(/\s+/).length / 2.5);
    clips.push({
      asset: {
        type: 'title',
        text: scriptLines.join(' '),
        style: 'minimal',
        color: '#ffffff',
        size: 'medium',
        position: 'center'
      },
      start: 0,
      length: audioDuration,
      fit: 'none',
      scale: 1,
      transition: { in: 'fade', out: 'fade' }
    });
    currentTime = audioDuration;
  }

  return {
    timeline: {
      background: '#0a66c2',
      ...(musicUrl && {
        soundtrack: {
          src: musicUrl,
          effect: 'fadeInFadeOut' as const
        }
      }),
      tracks: [{ clips }]
    },
    output: {
      format: 'mp4',
      size: { width: 1080, height: 1080 },
      fps: 30,
      scaleTo: 'crop'
    }
  };
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
