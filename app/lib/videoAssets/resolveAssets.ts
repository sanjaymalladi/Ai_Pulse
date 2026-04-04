import crypto from "crypto";
import fs from "fs";
import path from "path";
import { resolveLogoDevAsset } from "./providers/logoDev";
import { resolvePixabayAsset } from "./providers/pixabay";
import { verifyResolvedAsset } from "./verifyAssets";
import type { ResolvedAsset, SceneAssetRequest, ScenePlan, VideoPlan } from "@/app/lib/videoPlan/types";

const CACHE_DIR = path.join(process.cwd(), "public", "cache", "video-assets");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function extensionForMime(mimeType?: string) {
  if (!mimeType) return ".bin";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("svg")) return ".svg";
  return ".bin";
}

async function cacheAsset(asset: ResolvedAsset): Promise<ResolvedAsset> {
  if (!asset.url) return asset;
  ensureCacheDir();

  try {
    const response = await fetch(asset.url, { cache: "no-store" });
    if (!response.ok) return asset;
    const mimeType = response.headers.get("content-type") || asset.mimeType || undefined;
    const ext = extensionForMime(mimeType);
    const hash = crypto.createHash("sha1").update(asset.url).digest("hex");
    const filename = `${hash}${ext}`;
    const absolutePath = path.join(CACHE_DIR, filename);
    if (!fs.existsSync(absolutePath)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(absolutePath, buffer);
    }
    return { ...asset, localPath: `/cache/video-assets/${filename}`, mimeType };
  } catch {
    return asset;
  }
}

async function resolveRequest(request: SceneAssetRequest): Promise<ResolvedAsset | null> {
  if (request.kind === "logo") return resolveLogoDevAsset(request);
  if (request.kind === "image" || request.kind === "video") return resolvePixabayAsset(request);
  return null;
}

function internalFallback(scene: ScenePlan, reason: string): ResolvedAsset {
  return {
    kind: "icon",
    source: "internal",
    verified: true,
    confidence: 1,
    reason: `${reason} Using internal motion system for ${scene.template}.`,
  };
}

async function resolveSceneAssets(scene: ScenePlan): Promise<ScenePlan> {
  const resolved: ResolvedAsset[] = [];
  const requiredUserAssets: SceneAssetRequest[] = [];

  for (const request of scene.assets) {
    let candidate = await resolveRequest(request);
    if (candidate) {
      candidate = await verifyResolvedAsset(scene, candidate);
      if (!candidate.verified && scene.fallbackMode !== "internal_only") {
        const retried = await resolveRequest({
          ...request,
          query: `${request.query} ${scene.keywords.slice(0, 2).join(" ")}`.trim(),
        });
        if (retried) candidate = await verifyResolvedAsset(scene, retried);
      }
      if (candidate.verified) {
        candidate = await cacheAsset(candidate);
        resolved.push(candidate);
        continue;
      }
    }

    requiredUserAssets.push(request);
  }

  if (resolved.length === 0) {
    resolved.push(
      internalFallback(
        scene,
        requiredUserAssets.length > 0 ? "Awaiting user asset upload." : "No verified external assets.",
      ),
    );
  }

  return { ...scene, resolvedAssets: resolved, requiredUserAssets };
}

export async function enrichVideoPlanWithAssets(videoPlan: VideoPlan): Promise<VideoPlan> {
  const scenes = await Promise.all(videoPlan.scenes.map((scene) => resolveSceneAssets(scene)));
  return { ...videoPlan, scenes };
}
