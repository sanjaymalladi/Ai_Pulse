import { NextRequest, NextResponse } from "next/server";

const TTS_BASE = "https://sanjaymalladi-pocket-tts.hf.space";

export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const upstream = await fetch(`${TTS_BASE}/status/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await upstream.json().catch(async () => ({ error: await upstream.text() }));

    if (!upstream.ok) {
      return NextResponse.json(
        { error: payload.error || payload.detail || `TTS_STATUS_FAILED // HTTP ${upstream.status}` },
        { status: upstream.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch TTS job status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
