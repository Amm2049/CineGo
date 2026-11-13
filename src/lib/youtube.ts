// src/lib/youtube.ts
// CineGo -- YouTube helpers for movie trailers (no API key needed)

const OEMBED_URL = "https://www.youtube.com/oembed";

/**
 * Can this YouTube video be played inside our page? Some owners block playback on other websites;
 * YouTube's public oEmbed endpoint answers 401 for those (and 400/404 for unknown ids).
 * If the check itself fails (network, timeout), we assume yes: the pop-up also links to YouTube.
 */
export async function isYouTubeEmbeddable(key: string): Promise<boolean> {
  const url = `${OEMBED_URL}?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${key}`)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (res.ok) return true;
    return res.status >= 500; // 4xx = blocked or missing; 5xx = YouTube trouble, don't drop the trailer
  } catch {
    return true;
  }
}
