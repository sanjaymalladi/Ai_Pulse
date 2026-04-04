import { NextRequest, NextResponse } from "next/server";
import { enrichVideoPlanWithAssets } from "@/app/lib/videoAssets/resolveAssets";
import { generateVideoPlan } from "@/app/lib/videoPlan/planner";
import { isVideoPlan } from "@/app/lib/videoPlan/schema";
import type { TimingWord, VideoPlan } from "@/app/lib/videoPlan/types";

export const maxDuration = 180;

type DirectorBody = {
  script?: string;
  timings?: TimingWord[];
  videoPlan?: VideoPlan;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DirectorBody;

    let videoPlan = body.videoPlan;
    if (!videoPlan) {
      if (!body.script || !Array.isArray(body.timings)) {
        return NextResponse.json({ error: "Missing script or timings" }, { status: 400 });
      }
      videoPlan = await generateVideoPlan(body.script, body.timings);
    }

    if (!isVideoPlan(videoPlan)) {
      return NextResponse.json({ error: "Invalid video plan" }, { status: 400 });
    }

    const enrichedPlan = await enrichVideoPlanWithAssets(videoPlan);

    return NextResponse.json({
      success: true,
      status: "ready",
      videoPlan: enrichedPlan,
      sceneCount: enrichedPlan.scenes.length,
      durationSec: enrichedPlan.meta.durationSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Director pipeline failed";
    console.error("Director pipeline error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
