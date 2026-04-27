import { NextRequest, NextResponse } from "next/server";

const TTS_BASE = "https://sanjaymalladi-pocket-tts.hf.space";
const TTS_API_KEY = process.env.TTS_API_KEY ?? "";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string; requestId?: string };
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const upstream = await fetch(`${TTS_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, api_key: TTS_API_KEY }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const payload = await upstream.json().catch(async () => ({ error: await upstream.text() }));
    if (!upstream.ok) {
      return NextResponse.json(
        { error: payload.error || payload.detail || `TTS_START_FAILED // HTTP ${upstream.status}` },
        { status: upstream.status }
      );
    }

    return NextResponse.json({
      requestId: body.requestId ?? null,
      jobId: payload.job_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start TTS job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
