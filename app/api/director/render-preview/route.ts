import { NextRequest, NextResponse } from "next/server";
import { isVideoPlan } from "@/app/lib/videoPlan/schema";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { videoPlan?: unknown };
    if (!isVideoPlan(body.videoPlan)) {
      return NextResponse.json({ error: "Invalid video plan" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: "ready",
      sceneCount: body.videoPlan.scenes.length,
      durationSec: body.videoPlan.meta.durationSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
