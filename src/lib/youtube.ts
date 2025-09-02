/**
 * Extracts YouTube video ID from various URL formats
 */
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
    /youtube\.com\/watch\/.*[?&]v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Generates YouTube thumbnail URL from video ID - tries maxresdefault first
 */
export function getYouTubeThumbnail(videoId: string, quality: 'maxresdefault' | 'hqdefault' = 'maxresdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Gets thumbnail URL for a YouTube video URL with fallback chain
 */
export function getYouTubeThumbnailFromUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? getYouTubeThumbnail(videoId, 'maxresdefault') : null;
}

/**
 * Gets fallback thumbnail URL when maxresdefault fails
 */
export function getYouTubeFallbackThumbnail(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? getYouTubeThumbnail(videoId, 'hqdefault') : null;
}