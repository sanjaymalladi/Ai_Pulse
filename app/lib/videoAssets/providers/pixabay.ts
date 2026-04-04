import type { ResolvedAsset, SceneAssetRequest } from "@/app/lib/videoPlan/types";

type PixabayImageHit = {
  id: number;
  pageURL: string;
  webformatURL?: string;
  largeImageURL?: string;
  imageWidth?: number;
  imageHeight?: number;
  previewURL?: string;
};

type PixabayVideoHit = {
  id: number;
  pageURL: string;
  videos?: {
    large?: { url?: string; width?: number; height?: number; thumbnail?: string };
    medium?: { url?: string; width?: number; height?: number; thumbnail?: string };
    small?: { url?: string; width?: number; height?: number; thumbnail?: string };
  };
};

export async function resolvePixabayAsset(request: SceneAssetRequest): Promise<ResolvedAsset | null> {
  const key = process.env.PIXABAY_API || process.env.PIXABAY_API_KEY;
  if (!key) return null;

  const base = request.kind === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  const params = new URLSearchParams({
    key,
    q: request.query,
    safesearch: "true",
    per_page: "5",
    order: "popular",
  });

  if (request.kind === "video") {
    params.set("video_type", "film");
    params.set("min_width", "720");
    params.set("min_height", "720");
  } else {
    params.set("image_type", "photo");
    params.set("orientation", "horizontal");
    params.set("min_width", "1280");
    params.set("min_height", "720");
  }

  const response = await fetch(`${base}?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`PIXABAY_LOOKUP_FAILED ${response.status}`);
  }

  const data = (await response.json()) as { hits?: PixabayImageHit[] | PixabayVideoHit[] };
  const hit = data.hits?.[0];
  if (!hit) return null;

  if (request.kind === "video") {
    const video = hit as PixabayVideoHit;
    const source = video.videos?.medium?.url || video.videos?.small?.url || video.videos?.large?.url;
    if (!source) return null;
    return {
      kind: "video",
      source: "pixabay",
      url: source,
      previewUrl: video.videos?.medium?.thumbnail || video.videos?.small?.thumbnail || video.videos?.large?.thumbnail,
      width: video.videos?.medium?.width || video.videos?.small?.width || video.videos?.large?.width,
      height: video.videos?.medium?.height || video.videos?.small?.height || video.videos?.large?.height,
      mimeType: "video/mp4",
      providerId: String(video.id),
      verified: false,
      confidence: 0.68,
      reason: `Pixabay video candidate for "${request.query}".`,
    };
  }

  const image = hit as PixabayImageHit;
  const url = image.largeImageURL || image.webformatURL;
  if (!url) return null;
  return {
    kind: "image",
    source: "pixabay",
    url,
    previewUrl: image.previewURL || url,
    width: image.imageWidth,
    height: image.imageHeight,
    mimeType: "image/jpeg",
    providerId: String(image.id),
    verified: false,
    confidence: 0.66,
    reason: `Pixabay image candidate for "${request.query}".`,
  };
}
