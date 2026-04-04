import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const TTS_UPSTREAM = process.env.TTS_UPSTREAM ?? "https://sanjay.tailc61860.ts.net/tts";
const TTS_UPSTREAM_BASE = TTS_UPSTREAM.replace(/\/tts\/?$/, "");
const CACHE_DIR = path.join(process.cwd(), "public", "cache", "tts");

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;

  const upstream = await fetch(`${TTS_UPSTREAM_BASE}/tts/result/${encodeURIComponent(jobId)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return new Response(detail || "Failed to fetch TTS result", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "audio/wav";
  const contentDisposition =
    upstream.headers.get("content-disposition") || `attachment; filename="${jobId}.wav"`;
  const bytes = Buffer.from(await upstream.arrayBuffer());

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const filename = `${jobId}.wav`;
  fs.writeFileSync(path.join(CACHE_DIR, filename), bytes);

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "no-store",
      "X-Studio-Cache-Url": `/cache/tts/${filename}`,
    },
  });
}
