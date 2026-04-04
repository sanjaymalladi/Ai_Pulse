import type { ResolvedAsset, SceneAssetRequest } from "@/app/lib/videoPlan/types";

function sanitizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function resolveLogoDevAsset(request: SceneAssetRequest): Promise<ResolvedAsset | null> {
  const token =
    process.env.LOGO_API_KEY ||
    process.env.LOGO_API_SECRET ||
    process.env.LOGO_DEV_TOKEN ||
    process.env.LOGODEV_TOKEN ||
    process.env.LOGO_DEV_PUBLISHABLE_KEY;
  if (!token) return null;

  const query = sanitizeQuery(request.query);
  if (!query) return null;

  const src = query.includes(".")
    ? `https://img.logo.dev/${encodeURIComponent(query)}?token=${encodeURIComponent(token)}&size=256&format=png&theme=dark&fallback=404`
    : `https://img.logo.dev/name/${encodeURIComponent(query)}?token=${encodeURIComponent(token)}&size=256&format=png&theme=dark&fallback=404`;

  return {
    kind: "logo",
    source: "logo_dev",
    url: src,
    previewUrl: src,
    mimeType: "image/png",
    verified: false,
    confidence: 0.72,
    reason: "Logo.dev lookup candidate generated from brand query.",
  };
}
