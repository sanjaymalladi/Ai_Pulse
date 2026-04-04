import { NextRequest, NextResponse } from "next/server";
import { enrichVideoPlanWithAssets } from "@/app/lib/videoAssets/resolveAssets";
import { isVideoPlan } from "@/app/lib/videoPlan/schema";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { videoPlan?: unknown };
    if (!isVideoPlan(body.videoPlan)) {
      return NextResponse.json({ error: "Invalid video plan" }, { status: 400 });
    }

    const videoPlan = await enrichVideoPlanWithAssets(body.videoPlan);
    return NextResponse.json({ videoPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve assets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
