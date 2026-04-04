/**
 * Long TTS (5+ min) cannot run inside Vercel serverless within hobby limits.
 * Set NEXT_PUBLIC_TTS_DIRECT_URL to the same HTTP endpoint your API route would
 * call (must be reachable from the browser + CORS). Free options: ngrok, Cloudflare Tunnel, etc.
 */
export function getTtsDirectUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_TTS_DIRECT_URL;
  if (typeof u === "string" && u.trim().length > 0) return u.trim();
  return null;
}

/** True when deployed on Vercel (URL is set for all deployments). */
export function isVercelBrowser(): boolean {
  return typeof process.env.NEXT_PUBLIC_VERCEL_URL === "string";
}
