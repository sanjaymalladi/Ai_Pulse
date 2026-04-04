import { NextRequest, NextResponse } from "next/server";

const SPEECHMATICS_BASE = "https://asr.api.speechmatics.com/v2";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // ~5 minutes

type SpeechmaticsWord = {
  type?: string;
  start_time?: number;
  end_time?: number;
  alternatives?: Array<{ content?: string }>;
  content?: string;
};

function toNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function extractTimings(payload: unknown): Array<{ text: string; start: number; end: number }> {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as { results?: unknown; timings?: unknown };

  // Keep backward compatibility with existing shape.
  if (Array.isArray(obj.timings)) {
    return obj.timings
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const tt = t as { text?: unknown; start?: unknown; end?: unknown };
        const text = typeof tt.text === "string" ? tt.text : "";
        const start = toNumber(tt.start);
        const end = toNumber(tt.end);
        return text && start !== null && end !== null ? { text, start, end } : null;
      })
      .filter((v): v is { text: string; start: number; end: number } => v !== null);
  }

  const results = Array.isArray(obj.results) ? (obj.results as SpeechmaticsWord[]) : [];
  return results
    .filter((r) => r.type === "word")
    .map((r) => {
      const text =
        (typeof r.alternatives?.[0]?.content === "string" && r.alternatives[0].content) ||
        (typeof r.content === "string" ? r.content : "");
      const start = toNumber(r.start_time);
      const end = toNumber(r.end_time);
      return text && start !== null && end !== null ? { text, start, end } : null;
    })
    .filter((v): v is { text: string; start: number; end: number } => v !== null);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      process.env.Speechmatics_API_KEY || process.env.SPEECHMATICS_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Speechmatics API key (Speechmatics_API_KEY)" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("file");

    if (!(audioFile instanceof Blob)) {
      return NextResponse.json({ error: "Missing file blob" }, { status: 400 });
    }

    const uploadForm = new FormData();
    uploadForm.append("data_file", audioFile, "tts_audio.wav");
    uploadForm.append(
      "config",
      JSON.stringify({
        type: "transcription",
        transcription_config: { language: "en" },
      })
    );

    const createRes = await fetch(`${SPEECHMATICS_BASE}/jobs/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
      cache: "no-store",
    });

    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Speechmatics job create failed: ${createRes.status} ${body}`);
    }

    const created = (await createRes.json()) as { id?: string; job?: { id?: string } };
    const jobId = created.id || created.job?.id;
    if (!jobId) {
      throw new Error("Speechmatics did not return a job id");
    }

    let status = "";
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const statusRes = await fetch(`${SPEECHMATICS_BASE}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!statusRes.ok) {
        const body = await statusRes.text();
        throw new Error(`Speechmatics status failed: ${statusRes.status} ${body}`);
      }
      const statusBody = (await statusRes.json()) as { status?: string; job?: { status?: string } };
      status = (statusBody.job?.status || statusBody.status || "").toLowerCase();

      if (status === "done") break;
      if (status === "rejected" || status === "failed" || status === "error") {
        throw new Error(`Speechmatics job ${jobId} failed with status: ${status}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }

    if (status !== "done") {
      throw new Error("Speechmatics job timed out before completion");
    }

    const transcriptRes = await fetch(
      `${SPEECHMATICS_BASE}/jobs/${jobId}/transcript?format=json-v2`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      }
    );

    if (!transcriptRes.ok) {
      const body = await transcriptRes.text();
      throw new Error(`Speechmatics transcript failed: ${transcriptRes.status} ${body}`);
    }

    const transcript = (await transcriptRes.json()) as unknown;
    const timings = extractTimings(transcript);
    if (timings.length === 0) {
      throw new Error("Speechmatics transcript returned no word-level timings");
    }

    return NextResponse.json({ timings, provider: "speechmatics", jobId });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to extract timings via Speechmatics";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
