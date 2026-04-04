/**
 * Map arXiv abstract/PDF URLs to the experimental HTML reader (same paper, HTML layout).
 * Non-arXiv URLs are returned unchanged.
 *
 * @see https://arxiv.org/help/html
 */
export function preferArxivHtmlUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "arxiv.org") return url;

    const path = u.pathname;
    if (path.startsWith("/html/")) return url;

    const absMatch = path.match(/^\/abs\/([^/]+)/);
    if (absMatch) {
      return `https://arxiv.org/html/${absMatch[1]}`;
    }

    const pdfMatch = path.match(/^\/pdf\/(.+)$/i);
    if (pdfMatch) {
      const id = pdfMatch[1].replace(/\.pdf$/i, "");
      return `https://arxiv.org/html/${id}`;
    }

    return url;
  } catch {
    return url;
  }
}
