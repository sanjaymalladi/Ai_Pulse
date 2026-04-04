import { NextRequest, NextResponse } from "next/server";
import { generateVideoPlan } from "@/app/lib/videoPlan/planner";
import type { TimingWord } from "@/app/lib/videoPlan/types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { script?: string; timings?: TimingWord[] };
    if (!body.script || !Array.isArray(body.timings)) {
      return NextResponse.json({ error: "Missing script or timings" }, { status: 400 });
    }

    const videoPlan = await generateVideoPlan(body.script, body.timings);
    return NextResponse.json({ videoPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate video plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
