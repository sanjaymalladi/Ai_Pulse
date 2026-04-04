import type { ResolvedAsset, ScenePlan } from "@/app/lib/videoPlan/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function probeAsset(asset: ResolvedAsset): Promise<{ reachable: boolean; mimeType?: string }> {
  if (!asset.url) return { reachable: false };
  try {
    const response = await fetch(asset.url, { method: "HEAD", redirect: "follow", cache: "no-store" });
    return {
      reachable: response.ok,
      mimeType: response.headers.get("content-type") || asset.mimeType || undefined,
    };
  } catch {
    return { reachable: false };
  }
}

async function aiVerify(scene: ScenePlan, asset: ResolvedAsset): Promise<number | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !asset.url) return null;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_ASSET_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: 'You score whether an asset URL and metadata fit a short-form video scene. Return JSON: {"score": number, "reason": string}.' },
          {
            role: "user",
            content: JSON.stringify({
              scene: {
                voiceText: scene.voiceText,
                headline: scene.headline,
                visualIntent: scene.visualIntent,
                keywords: scene.keywords,
              },
              asset,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content) as { score?: number };
    return typeof parsed.score === "number" ? parsed.score : null;
  } catch {
    return null;
  }
}

export async function verifyResolvedAsset(scene: ScenePlan, asset: ResolvedAsset): Promise<ResolvedAsset> {
  if (asset.source === "internal") {
    return { ...asset, verified: true, confidence: 1, reason: asset.reason || "Internal visual fallback." };
  }

  const probe = await probeAsset(asset);
  let confidence = asset.confidence;
  let reason = asset.reason;

  if (!probe.reachable) {
    return { ...asset, verified: false, confidence: 0.15, reason: "Asset URL probe failed." };
  }

  if (probe.mimeType) {
    const compatible = (asset.kind === "video" && probe.mimeType.startsWith("video/")) || (asset.kind !== "video" && probe.mimeType.startsWith("image/"));
    if (!compatible) {
      return { ...asset, verified: false, confidence: 0.1, mimeType: probe.mimeType, reason: `Incompatible mime type: ${probe.mimeType}` };
    }
    reason = `${reason} Mime type ${probe.mimeType} passed.`;
  }

  if (typeof asset.width === "number" && typeof asset.height === "number") {
    const aspect = asset.width / Math.max(asset.height, 1);
    if (asset.kind === "image" && aspect < 0.7) {
      confidence -= 0.15;
      reason = `${reason} Vertical image may crop poorly.`;
    }
    if (asset.kind === "video" && aspect < 0.9) confidence -= 0.1;
  }

  const aiScore = await aiVerify(scene, asset);
  if (typeof aiScore === "number") {
    confidence = Math.min(1, Math.max(0, (confidence + aiScore) / 2));
    reason = `${reason} AI verifier score ${aiScore.toFixed(2)}.`;
  }

  return {
    ...asset,
    mimeType: probe.mimeType || asset.mimeType,
    verified: confidence >= 0.55,
    confidence,
    reason,
  };
}
