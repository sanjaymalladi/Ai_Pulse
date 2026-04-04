import { NextRequest, NextResponse } from "next/server";
import { buildAssetBrief, buildDirectorPrompt } from "@/app/lib/videoPlan/directorPrompt";
import { isVideoPlan } from "@/app/lib/videoPlan/schema";
import type { TimingWord } from "@/app/lib/videoPlan/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      script?: string;
      timings?: TimingWord[];
      videoPlan?: unknown;
    };

    if (!body.script || !Array.isArray(body.timings) || !isVideoPlan(body.videoPlan)) {
      return NextResponse.json({ error: "Missing script, timings, or valid video plan" }, { status: 400 });
    }

    const assetBrief = buildAssetBrief(body.videoPlan);
    const directorPrompt = buildDirectorPrompt({
      script: body.script,
      timings: body.timings,
      videoPlan: body.videoPlan,
    });

    return NextResponse.json({
      assetBrief,
      directorPrompt,
      sceneCount: body.videoPlan.scenes.length,
      durationSec: body.videoPlan.meta.durationSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build director prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
