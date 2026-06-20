const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_ATTEMPTS = 3;

/**
 * Fetch RSS XML with a long timeout and retries.
 * Render free-tier cold starts often exceed Node's default 10s connect timeout.
 */
export async function fetchRssText(
  url: string,
  options?: { totalTimeoutMs?: number; attempts?: number }
): Promise<string> {
  const totalTimeoutMs = options?.totalTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = Math.max(1, options?.attempts ?? DEFAULT_ATTEMPTS);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(totalTimeoutMs),
        headers: {
          "User-Agent": "AI-News-Studio/1.0",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });

      if (!res.ok) {
        throw new Error(`RSS fetch failed: HTTP ${res.status}`);
      }

      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
