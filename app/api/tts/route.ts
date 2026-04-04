import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Legacy /api/tts streaming endpoint is disabled. Use /api/tts/start, /api/tts/status/:jobId, and /api/tts/result/:jobId.",
    },
    { status: 410 }
  );
}
