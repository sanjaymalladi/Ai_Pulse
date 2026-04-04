import { TEMPLATE_CATALOG } from "./templateCatalog";
import { getRemotionBitsCatalog, type RemotionBitCatalogItem } from "./remotionBitsCatalog";
import { extractJsonObject, safeJsonParse } from "./schema";
import { buildFallbackPlan, normalizePlan } from "./normalizePlan";
import { segmentScript } from "./segmentScript";
import type { PlannerInput, TimingWord, VideoPlan } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const DEFAULT_PLANNER_TIMEOUT_MS = 25_000;

function compactBitCatalog(bitCatalog: RemotionBitCatalogItem[]) {
  return bitCatalog.map((bit) => ({
    id: bit.id,
    name: bit.name,
    family: bit.family,
    tags: bit.tags.slice(0, 6),
  }));
}

function getSystemPrompt(bitCatalog: Array<ReturnType<typeof compactBitCatalog>[number]>) {
  return `You are a storyboard planner for short-form 9:16 AI news videos.
Return strict JSON only.

Rules:
- Do not write TSX, JSX, CSS, or code.
- Use only the allowed scene templates.
- Produce between 6 and 12 scenes.
- Keep headline under 40 chars and 3 to 7 words whenever possible.
- Keep subhead under 70 chars.
- Prefer visual density over text density.
- Use short headlines and let animation carry the scene.
- Favor image_card_focus, hero_logo_statement, stat_compare, and diagram_flow before long quote scenes.
- Choose one supported remotion-bits motion hint per scene when useful.
- Prefer motion bits with tags like particles, cards, grid, camera, ken-burns, columns, scene-3d, gallery, stagger, transition, counter before text-only effects.
- Prefer internal visuals over external assets unless brand identity or a concrete physical subject matters.
- Request at most one asset per scene.
- If a scene works with typography, metrics, arrows, diagrams, nodes, or panels, avoid external assets.
- Ask for logos when company/product branding matters.
- Ask for hero images only for named people, products, or notable physical objects.
- If uncertain, prefer internal fallback modes.

Allowed templates:
${JSON.stringify(TEMPLATE_CATALOG, null, 2)}

Available remotion-bits catalog summary:
${JSON.stringify(bitCatalog, null, 2)}

Output shape:
{
  "meta": { "title": "optional string" },
  "scenes": [
    {
      "sceneId": "scene-1",
      "template": "kinetic_typography",
      "visualIntent": "string",
      "headline": "string",
      "subhead": "string",
      "keywords": ["string"],
      "motionLevel": "low|medium|high",
      "motionBit": "animated-text|gradient-transition|animated-counter",
      "motionBitId": "bit id from remotion-bits catalog",
      "fallbackMode": "internal_only|retry_then_internal|user_upload_optional",
      "assets": [
        { "kind": "logo|image|video|icon", "query": "string", "required": false, "role": "hero|supporting|brand" }
      ]
    }
  ]
}`;
}

async function callPlanner(input: PlannerInput): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");
  const bitCatalog = compactBitCatalog(await getRemotionBitsCatalog());
  const timeoutMs = Number(process.env.OPENROUTER_DIRECTOR_TIMEOUT_MS || DEFAULT_PLANNER_TIMEOUT_MS);

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_DIRECTOR_MODEL || DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: getSystemPrompt(bitCatalog) },
        {
          role: "user",
          content: JSON.stringify(
            {
              script: input.script,
              segments: input.segments,
              allowedTemplates: TEMPLATE_CATALOG.map((item) => item.id),
              allowedAssetKinds: ["logo", "image", "video", "icon"],
              availableMotionBits: bitCatalog,
            },
            null,
            2
          ),
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OPENROUTER_PLANNER_FAILED ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "";
  const jsonText = extractJsonObject(content) || content;
  return safeJsonParse<unknown>(jsonText);
}

export async function generateVideoPlan(script: string, timings: TimingWord[]): Promise<VideoPlan> {
  const segments = segmentScript(script, timings);
  if (segments.length === 0) {
    return buildFallbackPlan([{ sceneId: "scene-1", startSec: 0, endSec: 6, voiceText: script, keywords: [], importance: 1, visualIntent: "editorial fallback" }], script.slice(0, 80));
  }

  try {
    const raw = await callPlanner({ script, timings, segments });
    return normalizePlan(raw, segments, script);
  } catch (error) {
    console.error("Video plan generation failed, using fallback:", error);
    return buildFallbackPlan(segments, script.split(".")[0]?.slice(0, 80));
  }
}
